/**
 * REGENT: Rook Sync Edge Function
 *
 * Syncs leads and tickets to the client's external CRM.
 * Supports: HubSpot, Salesforce, Zoho CRM, Pipedrive.
 * Idempotent — safe to call multiple times for same entity.
 *
 * POST /functions/v1/rook-sync
 * Body: {
 *   client_id:   string,
 *   entity_type: 'lead' | 'ticket',
 *   entity_id:   string,
 *   force?:      boolean  // bypass already-synced check
 * }
 *
 * Returns: {
 *   success: boolean,
 *   crm_type: string,
 *   crm_record_id: string,
 *   action: 'created' | 'updated' | 'skipped'
 * }
 *
 * CRM credential formats (stored in clients.rook_crm_creds):
 *   HubSpot:     { access_token: string }
 *   Salesforce:  { instance_url: string, access_token: string }
 *   Zoho:        { access_token: string, api_domain?: string }
 *   Pipedrive:   { api_token: string, company_domain?: string }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ALLOWED_ORIGINS = ['https://hireregent.com', 'https://www.hireregent.com'];

// ─── Fetch with timeout ────────────────────────────────────
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Safe SOQL string escape ───────────────────────────────
// Valid emails cannot contain single quotes. Strip any that somehow sneak through.
function soqlEscapeEmail(email: string): string {
  const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_RE.test(email)) throw new Error(`Invalid email format for SOQL query: ${email}`);
  // Belt-and-suspenders: strip any remaining SOQL-dangerous chars
  return email.replace(/['"\\;]/g, '');
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// ─── HubSpot ──────────────────────────────────────────────

async function hubspotUpsertContact(
  accessToken: string,
  lead: any,
): Promise<{ id: string; action: string }> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const searchRes = await fetchWithTimeout('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
      properties: ['id', 'email', 'firstname', 'lastname'],
      limit: 1,
    }),
  });
  if (!searchRes.ok) throw new Error(`HubSpot contact search failed: ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  const existing = searchData.results?.[0];

  const nameParts = (lead.name || '').split(' ');
  const properties: Record<string, string> = {
    email:            lead.email,
    firstname:        nameParts[0] || '',
    lastname:         nameParts.slice(1).join(' ') || '',
    company:          lead.company || '',
    phone:            lead.phone || '',
    jobtitle:         lead.title || '',
    website:          lead.linkedin_url || '',
    hs_lead_status:   lead.bishop_status || 'NEW',
  };

  if (existing) {
    const updateRes = await fetchWithTimeout(
      `https://api.hubapi.com/crm/v3/objects/contacts/${existing.id}`,
      { method: 'PATCH', headers, body: JSON.stringify({ properties }) },
    );
    if (!updateRes.ok) throw new Error(`HubSpot update failed: ${await updateRes.text()}`);
    return { id: existing.id, action: 'updated' };
  }

  const createRes = await fetchWithTimeout('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ properties }),
  });
  if (!createRes.ok) throw new Error(`HubSpot create failed: ${await createRes.text()}`);
  const created = await createRes.json();
  return { id: created.id, action: 'created' };
}

async function hubspotUpsertTicket(
  accessToken: string,
  ticket: any,
): Promise<{ id: string; action: string }> {
  const priorityMap: Record<string, string> = {
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'HIGH',
  };
  const properties: Record<string, string> = {
    subject:            ticket.subject || `${ticket.source_channel} ticket`,
    content:            ticket.summary || '',
    hs_ticket_priority: priorityMap[ticket.priority] || 'MEDIUM',
    hs_pipeline_stage:  ticket.status === 'resolved' ? 'CLOSED' : 'NEW',
    source_type:        'CHAT',
  };

  const createRes = await fetchWithTimeout('https://api.hubapi.com/crm/v3/objects/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  if (!createRes.ok) throw new Error(`HubSpot ticket create failed: ${await createRes.text()}`);
  const created = await createRes.json();
  return { id: created.id, action: 'created' };
}

// ─── Salesforce ───────────────────────────────────────────

async function salesforceSync(
  creds: { instance_url: string; access_token: string },
  entityType: string,
  entity: any,
): Promise<{ id: string; action: string }> {
  const baseUrl = `${creds.instance_url}/services/data/v58.0`;
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    'Content-Type': 'application/json',
  };

  if (entityType === 'lead') {
    const nameParts = (entity.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || 'Unknown';

    // Search for existing Contact by email — use soqlEscapeEmail to prevent injection
    const safeEmail = soqlEscapeEmail(entity.email);
    const query = `SELECT Id FROM Contact WHERE Email = '${safeEmail}'`;
    const searchRes = await fetchWithTimeout(
      `${baseUrl}/query?q=${encodeURIComponent(query)}`,
      { headers },
    );
    if (!searchRes.ok) throw new Error(`Salesforce query failed: ${await searchRes.text()}`);
    const searchData = await searchRes.json();

    const contactPayload = {
      FirstName: firstName,
      LastName:  lastName,
      Email:     entity.email,
      Phone:     entity.phone   || '',
      Title:     entity.title   || '',
      Website:   entity.linkedin_url || '',
      AccountId: undefined as string | undefined,
    };
    // Remove undefined keys
    if (!contactPayload.AccountId) delete contactPayload.AccountId;

    if (searchData.records?.length > 0) {
      const contactId = searchData.records[0].Id;
      const updateRes = await fetchWithTimeout(`${baseUrl}/sobjects/Contact/${contactId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(contactPayload),
      });
      if (!updateRes.ok && updateRes.status !== 204) {
        throw new Error(`Salesforce Contact update failed: ${await updateRes.text()}`);
      }
      return { id: contactId, action: 'updated' };
    }

    const createRes = await fetchWithTimeout(`${baseUrl}/sobjects/Contact`, {
      method: 'POST',
      headers,
      body: JSON.stringify(contactPayload),
    });
    if (!createRes.ok) throw new Error(`Salesforce Contact create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    return { id: created.id, action: 'created' };

  } else {
    // ticket → Salesforce Case
    const priorityMap: Record<string, string> = {
      low: 'Low', medium: 'Medium', high: 'High', critical: 'High',
    };
    const createRes = await fetchWithTimeout(`${baseUrl}/sobjects/Case`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        Subject:     entity.subject || `${entity.source_channel} ticket`,
        Description: entity.summary || '',
        Priority:    priorityMap[entity.priority] || 'Medium',
        Status:      entity.status === 'resolved' ? 'Closed' : 'New',
        Origin:      'Web',
      }),
    });
    if (!createRes.ok) throw new Error(`Salesforce Case create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    return { id: created.id, action: 'created' };
  }
}

// ─── Zoho CRM ─────────────────────────────────────────────

async function zohoSync(
  creds: { access_token: string; api_domain?: string },
  entityType: string,
  entity: any,
): Promise<{ id: string; action: string }> {
  const apiDomain = creds.api_domain || 'https://www.zohoapis.com';
  const baseUrl   = `${apiDomain}/crm/v2`;
  const headers   = {
    Authorization:  `Zoho-oauthtoken ${creds.access_token}`,
    'Content-Type': 'application/json',
  };

  if (entityType === 'lead') {
    const nameParts = (entity.name || '').split(' ');

    // Search for existing Contact by email
    const searchRes = await fetchWithTimeout(
      `${baseUrl}/Contacts/search?criteria=(Email:equals:${encodeURIComponent(entity.email)})`,
      { headers },
    );
    // 204 = no records found (not an error); anything else non-ok = real failure
    if (!searchRes.ok && searchRes.status !== 204) {
      throw new Error(`Zoho Contact search failed (${searchRes.status}): ${await searchRes.text()}`);
    }
    const searchData = searchRes.ok ? await searchRes.json() : null;

    const contactPayload = {
      First_Name:   nameParts[0] || '',
      Last_Name:    nameParts.slice(1).join(' ') || 'Unknown',
      Email:        entity.email,
      Phone:        entity.phone    || '',
      Title:        entity.title    || '',
      Account_Name: entity.company  || '',
      Website:      entity.linkedin_url || '',
      Lead_Source:  'Web Site',
    };

    if (searchData?.data?.length > 0) {
      const contactId = searchData.data[0].id;
      const updateRes = await fetchWithTimeout(`${baseUrl}/Contacts/${contactId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: [contactPayload] }),
      });
      if (!updateRes.ok) throw new Error(`Zoho Contact update failed: ${await updateRes.text()}`);
      return { id: contactId, action: 'updated' };
    }

    const createRes = await fetchWithTimeout(`${baseUrl}/Contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [contactPayload] }),
    });
    if (!createRes.ok) throw new Error(`Zoho Contact create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    const createdId = created.data?.[0]?.details?.id;
    if (!createdId) throw new Error(`Zoho Contact create returned unexpected shape: ${JSON.stringify(created)}`);
    return { id: createdId, action: 'created' };

  } else {
    // ticket → Zoho Cases
    const createRes = await fetchWithTimeout(`${baseUrl}/Cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: [{
          Subject:     entity.subject || `${entity.source_channel} ticket`,
          Description: entity.summary || '',
          Priority:    entity.priority ? entity.priority.charAt(0).toUpperCase() + entity.priority.slice(1) : 'Medium',
          Status:      entity.status === 'resolved' ? 'Closed' : 'Open',
        }],
      }),
    });
    if (!createRes.ok) throw new Error(`Zoho Case create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    const createdId = created.data?.[0]?.details?.id;
    if (!createdId) throw new Error(`Zoho Case create returned unexpected shape: ${JSON.stringify(created)}`);
    return { id: createdId, action: 'created' };
  }
}

// ─── Pipedrive ────────────────────────────────────────────

async function pipedriveSync(
  creds: { api_token: string; company_domain?: string },
  entityType: string,
  entity: any,
): Promise<{ id: string; action: string }> {
  const domain  = creds.company_domain || 'api.pipedrive.com';
  const baseUrl = `https://${domain}/v1`;
  const token   = creds.api_token;

  if (entityType === 'lead') {
    // Search for existing Person by email
    const searchRes = await fetchWithTimeout(
      `${baseUrl}/persons/search?term=${encodeURIComponent(entity.email)}&fields=email&exact_match=true&api_token=${token}`,
    );
    const searchData = searchRes.ok ? await searchRes.json() : null;
    const existing   = searchData?.data?.items?.[0]?.item;

    const personPayload = {
      name:  entity.name || entity.email,
      email: [{ value: entity.email, primary: true }],
      ...(entity.phone ? { phone: [{ value: entity.phone, primary: true }] } : {}),
    };

    if (existing) {
      const updateRes = await fetchWithTimeout(`${baseUrl}/persons/${existing.id}?api_token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personPayload),
      });
      if (!updateRes.ok) throw new Error(`Pipedrive Person update failed: ${await updateRes.text()}`);
      return { id: String(existing.id), action: 'updated' };
    }

    // Create Person
    const createPersonRes = await fetchWithTimeout(`${baseUrl}/persons?api_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personPayload),
    });
    if (!createPersonRes.ok) {
      throw new Error(`Pipedrive Person create failed: ${await createPersonRes.text()}`);
    }
    const createdPerson = await createPersonRes.json();
    const personId = createdPerson.data?.id;
    if (!personId) throw new Error(`Pipedrive Person create returned unexpected shape: ${JSON.stringify(createdPerson)}`);

    // Create Lead record in Pipedrive
    const createLeadRes = await fetchWithTimeout(`${baseUrl}/leads?api_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:     `${entity.company || entity.name} — Regent Lead`,
        person_id: personId,
      }),
    });
    if (!createLeadRes.ok) throw new Error(`Pipedrive Lead create failed: ${await createLeadRes.text()}`);

    return { id: String(personId), action: 'created' };

  } else {
    // ticket → Pipedrive Note (no native ticket object)
    const createRes = await fetchWithTimeout(`${baseUrl}/notes?api_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[${(entity.priority || 'medium').toUpperCase()}] ${entity.subject || 'Support Ticket'}\n\n${entity.summary || ''}`,
      }),
    });
    if (!createRes.ok) throw new Error(`Pipedrive Note create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    return { id: String(created.data?.id), action: 'created' };
  }
}

// ─── Zendesk ──────────────────────────────────────────────
// Creds format: { subdomain: string, email: string, api_token: string }
// Auth: Basic base64("{email}/token:{api_token}")

async function zendeskSync(
  creds: { subdomain: string; email: string; api_token: string },
  entityType: string,
  entity: any,
): Promise<{ id: string; action: string }> {
  const { subdomain, email, api_token } = creds;
  if (!subdomain || !email || !api_token) {
    throw new Error('Zendesk creds must include subdomain, email, and api_token');
  }

  const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
  const authHeader = 'Basic ' + btoa(`${email}/token:${api_token}`);
  const headers = {
    'Authorization': authHeader,
    'Content-Type':  'application/json',
  };

  if (entityType === 'lead') {
    // Search for existing user by email
    const searchRes = await fetchWithTimeout(
      `${baseUrl}/users/search.json?query=${encodeURIComponent(`email:${entity.email}`)}`,
      { headers },
    );
    const searchData = searchRes.ok ? await searchRes.json() : null;
    const existingUser = searchData?.users?.[0];

    if (existingUser) {
      // Update existing user
      const updateRes = await fetchWithTimeout(`${baseUrl}/users/${existingUser.id}.json`, {
        method:  'PUT',
        headers,
        body: JSON.stringify({
          user: {
            name:  entity.name || existingUser.name,
            phone: entity.phone || existingUser.phone,
            ...(entity.title ? { user_fields: { job_title: entity.title } } : {}),
          },
        }),
      });
      if (!updateRes.ok) throw new Error(`Zendesk user update failed: ${await updateRes.text()}`);
      return { id: String(existingUser.id), action: 'updated' };
    }

    // Create new user
    const createRes = await fetchWithTimeout(`${baseUrl}/users.json`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        user: {
          name:  entity.name || entity.email,
          email: entity.email,
          ...(entity.phone ? { phone: entity.phone } : {}),
          ...(entity.title ? { user_fields: { job_title: entity.title } } : {}),
          role:  'end-user',
        },
      }),
    });
    if (!createRes.ok) throw new Error(`Zendesk user create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    return { id: String(created.user?.id), action: 'created' };

  } else {
    // ticket → Zendesk Ticket
    const priority = entity.priority === 'critical' ? 'urgent'
                   : entity.priority === 'medium'   ? 'normal'
                   : 'low';

    const tags: string[] = ['regent', 'knight'];
    if (entity.source_channel) tags.push(entity.source_channel);
    if (entity.priority)       tags.push(entity.priority);

    const createRes = await fetchWithTimeout(`${baseUrl}/tickets.json`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject:     entity.subject || `${entity.source_channel || 'Support'} ticket`,
          comment:     { body: entity.summary || entity.content || '' },
          requester:   { email: entity.source_handle || undefined },
          priority,
          tags,
          status:      entity.status === 'resolved' ? 'solved'
                     : entity.status === 'escalated' ? 'open'
                     : 'new',
        },
      }),
    });

    if (!createRes.ok) throw new Error(`Zendesk ticket create failed: ${await createRes.text()}`);
    const created = await createRes.json();
    const ticketId = created.ticket?.id;
    if (!ticketId) throw new Error(`Zendesk ticket create returned unexpected shape: ${JSON.stringify(created)}`);
    return { id: String(ticketId), action: 'created' };
  }
}

// ─── Main handler ─────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { client_id, entity_type, entity_id, force = false } = body;

    if (!client_id || !entity_type || !entity_id) {
      return new Response(JSON.stringify({ error: 'client_id, entity_type, entity_id required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Load client config ──────────────────────────────────
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, rook_enabled, rook_crm_type, rook_crm_creds')
      .eq('id', client_id)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!client.rook_enabled) {
      return new Response(JSON.stringify({ success: true, action: 'skipped', reason: 'rook_disabled' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!client.rook_crm_type || !client.rook_crm_creds) {
      return new Response(JSON.stringify({ error: 'Client has no CRM configured' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Idempotency check (skip if already synced, unless force=true) ──
    if (!force) {
      const { data: existing } = await supabase
        .from('rook_crm_syncs')
        .select('id, crm_record_id, sync_status')
        .eq('client_id', client_id)
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
        .eq('crm_type', client.rook_crm_type)
        .eq('sync_status', 'synced')
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({
          success:       true,
          action:        'skipped',
          reason:        'already_synced',
          crm_record_id: existing.crm_record_id,
        }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ── Load the entity ─────────────────────────────────────
    const table = entity_type === 'lead' ? 'leads' : 'tickets';
    const { data: entity, error: entityErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', entity_id)
      .single();

    if (entityErr || !entity) {
      return new Response(JSON.stringify({ error: `${entity_type} not found` }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Log sync attempt ────────────────────────────────────
    const { data: syncLog } = await supabase
      .from('rook_crm_syncs')
      .upsert({
        client_id,
        entity_type,
        entity_id,
        crm_type:    client.rook_crm_type,
        sync_status: 'pending',
        payload:     entity,
      }, { onConflict: 'client_id,entity_type,entity_id,crm_type' })
      .select('id')
      .single();

    // ── Dispatch to CRM ─────────────────────────────────────
    let result: { id: string; action: string };
    const creds = client.rook_crm_creds;

    try {
      switch (client.rook_crm_type) {
        case 'hubspot':
          result = entity_type === 'lead'
            ? await hubspotUpsertContact(creds.access_token, entity)
            : await hubspotUpsertTicket(creds.access_token, entity);
          break;

        case 'salesforce':
          result = await salesforceSync(creds, entity_type, entity);
          break;

        case 'zoho':
          result = await zohoSync(creds, entity_type, entity);
          break;

        case 'pipedrive':
          result = await pipedriveSync(creds, entity_type, entity);
          break;

        case 'zendesk':
          result = await zendeskSync(creds, entity_type, entity);
          break;

        default:
          throw new Error(`Unsupported CRM type: ${client.rook_crm_type}`);
      }
    } catch (crmErr) {
      if (syncLog?.id) {
        await supabase
          .from('rook_crm_syncs')
          .update({ sync_status: 'failed', error_msg: String(crmErr) })
          .eq('id', syncLog.id);
      }
      throw crmErr;
    }

    // ── Mark synced ─────────────────────────────────────────
    if (syncLog?.id) {
      await supabase
        .from('rook_crm_syncs')
        .update({
          sync_status:   'synced',
          crm_record_id: result.id,
          synced_at:     new Date().toISOString(),
          error_msg:     null,
        })
        .eq('id', syncLog.id);
    }

    console.log(`[Rook] ✓ ${result.action} ${entity_type} ${entity_id} → ${client.rook_crm_type} #${result.id}`);

    return new Response(
      JSON.stringify({
        success:       true,
        crm_type:      client.rook_crm_type,
        crm_record_id: result.id,
        action:        result.action,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );

  } catch (err) {
    console.error('[Rook] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
