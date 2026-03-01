/**
 * REGENT: Pawn Verify Edge Function
 *
 * The Gatekeeper — validates and deduplicates raw scraped leads
 * before they enter Bishop's outbound pipeline.
 *
 * POST /functions/v1/pawn-verify
 * Body: {
 *   leads: Array<{ name, email, company, phone?, title?, linkedin_url?, context_notes?, source_url? }>,
 *   client_id?: string,    // scope dedup to this client
 *   workspace_id?: string, // OR scope to workspace
 *   user_id?: string,      // required if no client_id/workspace_id
 *   auto_insert?: boolean  // default true — insert clean leads automatically
 * }
 *
 * Returns: {
 *   clean: Lead[],       — passed all checks (inserted if auto_insert=true)
 *   duplicates: Lead[],  — already exist in DB
 *   invalid: Lead[],     — failed email/format validation
 *   stats: { total, clean, duplicates, invalid }
 * }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Email validation ─────────────────────────────────────
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', '10minutemail.com', 'trashmail.com', 'fakeinbox.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'nospam.ze.tc', 'dispostable.com', 'mailnull.com',
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
    const {
      leads,
      client_id,
      workspace_id,
      user_id,
      auto_insert = true,
    } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ error: 'leads array is required and must not be empty' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const clean: any[] = [];
    const duplicates: any[] = [];
    const invalid: any[] = [];

    // ── Step 1: Validate email format ──────────────────────
    const validCandidates: any[] = [];
    for (const lead of leads) {
      if (!isValidEmail(lead.email)) {
        invalid.push({ ...lead, _reason: 'invalid_email' });
      } else {
        validCandidates.push({ ...lead, email: normalizeEmail(lead.email) });
      }
    }

    // ── Step 2: Batch dedup check ──────────────────────────
    if (validCandidates.length > 0) {
      const emails = validCandidates.map((l) => l.email);

      let query = supabase.from('leads').select('email').in('email', emails);

      if (client_id) {
        query = query.eq('client_id', client_id);
      } else if (workspace_id) {
        query = query.eq('workspace_id', workspace_id);
      } else if (user_id) {
        query = query.eq('user_id', user_id);
      }

      const { data: existingRows, error: dedupErr } = await query;
      if (dedupErr) {
        console.error('[Pawn] Dedup query error:', dedupErr);
      }

      const existingEmails = new Set((existingRows || []).map((r: any) => r.email));

      for (const lead of validCandidates) {
        if (existingEmails.has(lead.email)) {
          duplicates.push({ ...lead, _reason: 'duplicate_email' });
        } else {
          clean.push(lead);
        }
      }

      // ── Step 3: Insert clean leads ─────────────────────
      if (auto_insert && clean.length > 0) {
        const now = new Date().toISOString();

        const toInsert = clean.map((l) => ({
          name:          l.name        || null,
          email:         l.email,
          company:       l.company     || null,
          phone:         l.phone       || null,
          source:        'web_scrape',
          status:        'new',
          bishop_status: 'INTRO_SENT',
          client_id:     client_id     || null,
          workspace_id:  workspace_id  || null,
          user_id:       user_id       || null,
          context_notes: l.context_notes  || null,
          enrichment_data: l.enrichment_data || {},
          last_contact_date: null,
          next_action_due:   now,  // eligible for Bishop immediately
        }));

        const { error: insertErr } = await supabase.from('leads').insert(toInsert);
        if (insertErr) {
          console.error('[Pawn] Insert error:', insertErr);
          return new Response(JSON.stringify({ error: 'DB insert failed', details: insertErr.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // ── Step 4: Log the pawn job ───────────────────────
      await supabase.from('pawn_jobs').insert({
        client_id:    client_id  || null,
        job_type:     'verify',
        status:       'done',
        total:        leads.length,
        clean:        clean.length,
        duplicates:   duplicates.length,
        invalid:      invalid.length,
        completed_at: new Date().toISOString(),
        result: {
          inserted: auto_insert ? clean.length : 0,
          sample_clean:      clean.slice(0, 3).map((l) => l.email),
          sample_duplicates: duplicates.slice(0, 3).map((l) => l.email),
          sample_invalid:    invalid.slice(0, 3).map((l) => l.email),
        },
      });
    }

    return new Response(
      JSON.stringify({
        clean,
        duplicates,
        invalid,
        stats: {
          total:      leads.length,
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
