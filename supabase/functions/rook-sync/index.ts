/**
 * REGENT: Rook Sync Edge Function
 *
 * Syncs leads and tickets to the client's external CRM.
 * Supports: HubSpot (native), Salesforce (stub), Zoho (stub).
 * Idempotent — safe to call multiple times for same entity.
 *
 * POST /functions/v1/rook-sync
 * Body: {
 *   client_id:   string,
 *   entity_type: 'lead' | 'ticket',
 *   entity_id:   string
 * }
 *
 * Returns: {
 *   success: boolean,
 *   crm_type: string,
 *   crm_record_id: string,
 *   action: 'created' | 'updated' | 'skipped'
 * }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   CRM credentials stored in clients.rook_crm_creds (JSONB)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── HubSpot API helpers ──────────────────────────────────
async function hubspotUpsertContact(
  accessToken: string,
  lead: any
): Promise<{ id: string; action: string }> {
  // Search for existing contact by email
  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }],
      }],
      properties: ['id', 'email', 'firstname', 'lastname'],
      limit: 1,
    }),
  });

  const searchData = await searchRes.json();
  const existing = searchData.results?.[0];

  const nameParts = (lead.name || '').split(' ');
  const properties: Record<string, string> = {
    email:     lead.email,
    firstname: nameParts[0] || '',
    lastname:  nameParts.slice(1).join(' ') || '',
    company:   lead.company || '',
    phone:     lead.phone   || '',
    jobtitle:  lead.title   || '',
    website:   lead.linkedin_url || '',
    hs_lead_status: 'NEW',
  };

  if (existing) {
    // Update existing contact
    const updateRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${existing.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      }
    );
    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`HubSpot update failed: ${err}`);
    }
    return { id: existing.id, action: 'updated' };

  } else {
    // Create new contact
    const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`HubSpot create failed: ${err}`);
    }
    const created = await createRes.json();
    return { id: created.id, action: 'created' };
  }
}

async function hubspotUpsertTicket(
  accessToken: string,
  ticket: any
): Promise<{ id: string; action: string }> {
  const priorityMap: Record<string, string> = {
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'HIGH',
  };

  const properties: Record<string, string> = {
    subject:     ticket.subject || `${ticket.source_channel} ticket`,
    content:     ticket.summary || '',
    hs_ticket_priority: priorityMap[ticket.priority] || 'MEDIUM',
    hs_pipeline_stage:  ticket.status === 'resolved' ? 'CLOSED' : 'NEW',
    source_type: 'CHAT',
  };

  const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/tickets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`HubSpot ticket create failed: ${err}`);
  }
  const created = await createRes.json();
  return { id: created.id, action: 'created' };
}

// ─── Salesforce stub ──────────────────────────────────────
async function salesforceSync(
  _creds: any,
  _entityType: string,
  _entity: any
): Promise<{ id: string; action: string }> {
  // TODO: implement Salesforce REST API sync
  // Requires: instance_url, access_token (via OAuth2 client_credentials)
  throw new Error('Salesforce sync not yet implemented — coming soon');
}

// ─── Zoho stub ────────────────────────────────────────────
async function zohoSync(
  _creds: any,
  _entityType: string,
  _entity: any
): Promise<{ id: string; action: string }> {
  // TODO: implement Zoho CRM v2 API sync
  // Requires: access_token, api_domain
  throw new Error('Zoho sync not yet implemented — coming soon');
}

// ─── Main handler ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { client_id, entity_type, entity_id } = body;

    if (!client_id || !entity_type || !entity_id) {
      return new Response(JSON.stringify({ error: 'client_id, entity_type, entity_id required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Load client config ─────────────────────────────────
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

    // ── Check if already synced (idempotency) ──────────────
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

    // ── Load the entity ────────────────────────────────────
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

    // ── Log sync attempt ───────────────────────────────────
    const { data: syncLog } = await supabase
      .from('rook_crm_syncs')
      .upsert({
        client_id,
        entity_type,
        entity_id,
        crm_type:   client.rook_crm_type,
        sync_status: 'pending',
        payload:     entity,
      }, { onConflict: 'client_id,entity_type,entity_id,crm_type' })
      .select('id')
      .single();

    // ── Dispatch to the right CRM ──────────────────────────
    let result: { id: string; action: string };
    const creds = client.rook_crm_creds;

    try {
      if (client.rook_crm_type === 'hubspot') {
        result = entity_type === 'lead'
          ? await hubspotUpsertContact(creds.access_token, entity)
          : await hubspotUpsertTicket(creds.access_token, entity);

      } else if (client.rook_crm_type === 'salesforce') {
        result = await salesforceSync(creds, entity_type, entity);

      } else if (client.rook_crm_type === 'zoho') {
        result = await zohoSync(creds, entity_type, entity);

      } else {
        throw new Error(`Unsupported CRM type: ${client.rook_crm_type}`);
      }

    } catch (crmErr) {
      // Mark as failed
      if (syncLog?.id) {
        await supabase
          .from('rook_crm_syncs')
          .update({ sync_status: 'failed', error_msg: String(crmErr) })
          .eq('id', syncLog.id);
      }
      throw crmErr;
    }

    // ── Mark sync as successful ────────────────────────────
    if (syncLog?.id) {
      await supabase
        .from('rook_crm_syncs')
        .update({
          sync_status:   'synced',
          crm_record_id: result.id,
          synced_at:     new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    console.log(`[Rook] ✓ Synced ${entity_type} ${entity_id} → ${client.rook_crm_type} #${result.id}`);

    return new Response(
      JSON.stringify({
        success:       true,
        crm_type:      client.rook_crm_type,
        crm_record_id: result.id,
        action:        result.action,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[Rook] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
