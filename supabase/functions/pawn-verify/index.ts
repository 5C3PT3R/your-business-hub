/**
 * REGENT: Pawn Verify Edge Function
 *
 * The Gatekeeper — validates, enriches, and deduplicates raw leads
 * before they enter Bishop's outbound pipeline.
 *
 * POST /functions/v1/pawn-verify
 * Body (leads mode):
 *   {
 *     leads: Array<{ name, email, company, phone?, title?, linkedin_url?, context_notes?, source_url?, enrichment_data? }>,
 *     client_id?: string,
 *     workspace_id?: string,
 *     user_id?: string,       // required for pawn_jobs logging
 *     auto_insert?: boolean   // default true
 *   }
 *
 * Body (domain-search mode):
 *   {
 *     domains: string[],      // e.g. ["stripe.com", "notion.so"] — Hunter domain-search per domain
 *     client_id?: string,
 *     workspace_id?: string,
 *     user_id?: string,
 *     auto_insert?: boolean   // default false in domain mode (show staging first)
 *   }
 *
 * Returns:
 *   {
 *     clean: Lead[],          — passed all checks (inserted if auto_insert=true)
 *     duplicates: Lead[],     — already in DB
 *     invalid: Lead[],        — failed validation
 *     stats: { total, clean, duplicates, invalid, inserted }
 *   }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   HUNTER_API_KEY  (optional — enables domain-search mode + confidence scoring)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ALLOWED_ORIGINS = ['https://hireregent.com', 'https://www.hireregent.com'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// ─── Email validation ─────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// Expanded disposable / throwaway domain list
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'throwaway.email',
  'yopmail.com', 'yopmail.fr', '10minutemail.com', '10minutemail.net', '10minutemail.org',
  'trashmail.com', 'trashmail.me', 'trashmail.net', 'trashmail.org', 'trashmail.at',
  'fakeinbox.com', 'fakeinbox.net', 'sharklasers.com', 'spam4.me',
  'dispostable.com', 'mailnull.com', 'spamgourmet.com', 'spamgourmet.net',
  'nospam.ze.tc', 'grr.la', 'spamevader.com', 'inboxbear.com',
  'throwam.com', 'maildrop.cc', 'mailnesia.com', 'tempr.email',
  'discardmail.com', 'discardmail.de', 'spamfree24.org', 'drdrb.com',
  'getonemail.com', 'filzmail.com', 'zetmail.com', 'spamhereplease.com',
  'spamobox.com', 'tempemail.net', 'cuam.de', 'courriel.fr.nf',
  'mailexpire.com', 'spaml.de', 'xagloo.co', 'armyspy.com',
  'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu',
  'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com',
  'teleworm.us', 'placeholder.producthunt',
]);

// Role-based addresses — almost always catch-all, low deliverability
const ROLE_PREFIXES = new Set([
  'info', 'contact', 'hello', 'support', 'admin', 'help', 'sales',
  'marketing', 'team', 'office', 'mail', 'email', 'noreply', 'no-reply',
  'webmaster', 'postmaster', 'enquiries', 'enquiry',
]);

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return false;
  const domain = trimmed.split('@')[1];
  return !BLOCKED_DOMAINS.has(domain);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Basic confidence scoring without external API calls
function scoreEmail(email: string, hunterConfidence?: number): { confidence: number; status: 'valid' | 'risky' | 'invalid' } {
  if (hunterConfidence !== undefined) {
    const status = hunterConfidence >= 80 ? 'valid' : hunterConfidence >= 50 ? 'risky' : 'invalid';
    return { confidence: hunterConfidence, status };
  }

  const local = email.split('@')[0].toLowerCase();
  const domain = email.split('@')[1]?.toLowerCase() ?? '';

  // Role-based addresses have low confidence
  if (ROLE_PREFIXES.has(local)) {
    return { confidence: 35, status: 'risky' };
  }

  // Pattern scoring: firstname.lastname@company.com scores highest
  const hasName = /^[a-z]+[\.\-_][a-z]+$/.test(local);
  const hasSingleName = /^[a-z]{3,}$/.test(local);
  const isGenericTld = domain.endsWith('.com') || domain.endsWith('.io') || domain.endsWith('.co');

  if (hasName && isGenericTld) return { confidence: 78, status: 'valid' };
  if (hasSingleName && isGenericTld) return { confidence: 68, status: 'valid' };
  if (hasName) return { confidence: 65, status: 'valid' };
  return { confidence: 55, status: 'risky' };
}

// ─── Hunter.io domain-search ──────────────────────────────
interface HunterContact {
  name: string;
  email: string;
  company: string;
  domain: string;
  role: string;
  email_confidence: number;
  email_status: 'valid' | 'risky' | 'invalid' | 'unverified';
  context_notes: string;
  enrichment_data: Record<string, unknown>;
}

async function hunterDomainSearch(domain: string, apiKey: string): Promise<HunterContact[]> {
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[Pawn] Hunter domain-search HTTP ${res.status} for ${domain}`);
      return [];
    }

    const data = await res.json();
    const company = data.data?.organization || domain;
    const emails: any[] = data.data?.emails || [];

    return emails
      .filter((e: any) => e.value && e.first_name)
      .map((e: any) => {
        const scored = scoreEmail(e.value, e.confidence);
        return {
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          email: e.value.trim().toLowerCase(),
          company,
          domain,
          role: e.position || '',
          email_confidence: scored.confidence,
          email_status: scored.status,
          context_notes: `Hunter domain-search: ${e.position || 'Contact'} at ${company}`,
          enrichment_data: {
            domain,
            hunter_confidence: e.confidence,
            company_type: data.data?.type,
            company_size: data.data?.company_size,
            linkedin: e.linkedin || null,
            twitter: e.twitter || null,
            phone: e.phone_number || null,
          },
        };
      });
  } catch (err) {
    console.error(`[Pawn] Hunter domain-search error for ${domain}:`, err);
    return [];
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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const startedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      leads: rawLeads,
      domains,
      client_id,
      workspace_id,
      user_id,
    } = body;

    // auto_insert defaults: true for leads mode, false for domain-search mode
    const isDomainMode = Array.isArray(domains) && domains.length > 0;
    const auto_insert = body.auto_insert ?? (isDomainMode ? false : true);

    // ── Domain-search mode: fetch contacts from Hunter ─────
    let inputLeads: any[] = [];

    if (isDomainMode) {
      if (!HUNTER_API_KEY) {
        return new Response(JSON.stringify({
          error: 'Domain-search mode requires HUNTER_API_KEY. Add it to Supabase secrets.',
        }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Search all domains in parallel (cap at 10)
      const domainList: string[] = domains.slice(0, 10);
      const searches = await Promise.allSettled(
        domainList.map((d: string) => hunterDomainSearch(d.trim().toLowerCase().replace(/^https?:\/\//, ''), HUNTER_API_KEY))
      );

      for (const result of searches) {
        if (result.status === 'fulfilled') {
          inputLeads.push(...result.value);
        }
      }

      if (inputLeads.length === 0) {
        return new Response(JSON.stringify({
          clean: [], duplicates: [], invalid: [],
          stats: { total: 0, clean: 0, duplicates: 0, invalid: 0, inserted: 0 },
          message: 'No contacts found for the given domains. Ensure domains are correct (e.g. stripe.com not stripe).',
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } else {
      // Leads mode
      if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
        return new Response(JSON.stringify({
          error: 'Provide either leads[] or domains[] in the request body.',
        }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      inputLeads = rawLeads;
    }

    const clean: any[] = [];
    const duplicates: any[] = [];
    const invalid: any[] = [];

    // ── Step 1: Validate email format + disposable check ──
    const validCandidates: any[] = [];
    for (const lead of inputLeads) {
      if (!isValidEmail(lead.email)) {
        invalid.push({ ...lead, _reason: 'invalid_email' });
      } else {
        const email = normalizeEmail(lead.email);
        const hunterConf = lead.enrichment_data?.hunter_confidence as number | undefined;
        const scored = isDomainMode
          ? { confidence: lead.email_confidence ?? 50, status: lead.email_status ?? 'unverified' }
          : scoreEmail(email, hunterConf);

        validCandidates.push({
          ...lead,
          email,
          email_confidence: scored.confidence,
          email_status: scored.status,
        });
      }
    }

    // ── Step 2: Intra-batch dedup ──────────────────────────
    const seenInBatch = new Set<string>();
    const dedupedCandidates = validCandidates.filter(lead => {
      if (seenInBatch.has(lead.email)) {
        duplicates.push({ ...lead, _reason: 'duplicate_in_batch' });
        return false;
      }
      seenInBatch.add(lead.email);
      return true;
    });

    // ── Step 3: DB dedup check ─────────────────────────────
    if (dedupedCandidates.length > 0) {
      const emails = dedupedCandidates.map((l) => l.email);

      let query = supabase.from('leads').select('email').in('email', emails);
      if (client_id)     query = query.eq('client_id', client_id);
      else if (workspace_id) query = query.eq('workspace_id', workspace_id);
      else if (user_id)  query = query.eq('user_id', user_id);

      const { data: existingRows, error: dedupErr } = await query;
      if (dedupErr) {
        console.error('[Pawn] Dedup query error:', dedupErr);
      }

      const existingEmails = new Set((existingRows || []).map((r: any) => r.email));

      for (const lead of dedupedCandidates) {
        if (existingEmails.has(lead.email)) {
          duplicates.push({ ...lead, _reason: 'duplicate_email' });
        } else {
          clean.push(lead);
        }
      }

      // ── Step 4: Insert clean leads ─────────────────────
      if (auto_insert && clean.length > 0) {
        const now = new Date().toISOString();

        const toInsert = clean.map((l) => ({
          name:             l.name         || null,
          email:            l.email,
          company:          l.company      || null,
          phone:            l.phone        || null,
          source:           'pawn_scout',
          status:           'new',
          bishop_status:    'NEW',           // Correct: new lead enters pipeline at NEW
          client_id:        client_id       || null,
          workspace_id:     workspace_id    || null,
          user_id:          user_id         || null,
          context_notes:    l.context_notes || null,
          enrichment_data:  l.enrichment_data || {},
          email_confidence: l.email_confidence ?? null,
          icebreaker_context: l.icebreaker_context || null,
          signal_strength:  l.signal_strength ?? null,
          last_contact_date: null,
          next_action_due:  now,
        }));

        const { error: insertErr } = await supabase.from('leads').insert(toInsert);
        if (insertErr) {
          console.error('[Pawn] Insert error:', insertErr);
          // Retry without workspace_id (FK constraint fallback)
          const fallback = toInsert.map(({ workspace_id: _ws, ...l }) => l);
          const { error: fallbackErr } = await supabase.from('leads').insert(fallback);
          if (fallbackErr) {
            console.error('[Pawn] Fallback insert failed:', fallbackErr);
            return new Response(JSON.stringify({
              error: 'DB insert failed',
              details: fallbackErr.message,
            }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
        }
      }

      // ── Step 5: Log the pawn job ───────────────────────
      await supabase.from('pawn_jobs').insert({
        client_id:    client_id  || null,
        job_type:     isDomainMode ? 'scrape' : 'verify',
        status:       'done',
        total:        inputLeads.length,
        clean:        clean.length,
        duplicates:   duplicates.length,
        invalid:      invalid.length,
        started_at:   startedAt,
        completed_at: new Date().toISOString(),
        result: {
          mode:              isDomainMode ? 'domain_search' : 'leads',
          inserted:          auto_insert ? clean.length : 0,
          user_id:           user_id || null,
          workspace_id:      workspace_id || null,
          sample_clean:      clean.slice(0, 3).map((l) => l.email),
          sample_duplicates: duplicates.slice(0, 3).map((l) => l.email),
          sample_invalid:    invalid.slice(0, 3).map((l) => l.email),
          domains:           isDomainMode ? domains : undefined,
        },
      });
    }

    return new Response(
      JSON.stringify({
        clean,
        duplicates,
        invalid,
        stats: {
          total:      inputLeads.length,
          clean:      clean.length,
          duplicates: duplicates.length,
          invalid:    invalid.length,
          inserted:   auto_insert ? clean.length : 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[Pawn] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
