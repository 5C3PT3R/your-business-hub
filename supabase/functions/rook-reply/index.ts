/**
 * REGENT: Rook Reply Edge Function
 *
 * Processes inbound email replies from Bishop prospects.
 * Uses Claude AI to classify intent and extract signature data,
 * then updates the lead in Supabase and triggers CRM sync.
 *
 * Called by n8n when Gmail receives a reply to a Bishop email.
 *
 * POST /functions/v1/rook-reply
 * Body: {
 *   lead_id:       string,   // UUID of the lead who replied
 *   email_body:    string,   // full reply body (plain text)
 *   current_state: string,   // lead's current bishop_status
 *   client_id?:    string,   // optional — triggers CRM sync if provided
 * }
 *
 * Returns: {
 *   success: boolean,
 *   intent_classification: string,
 *   classification_confidence: number,
 *   signature_data: { extracted_phone: string|null, extracted_title: string|null },
 *   suggested_next_state: string,
 *   lead_updated: boolean,
 *   crm_synced: boolean,
 * }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ─── Fetch with timeout ────────────────────────────────────
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Idempotency key ──────────────────────────────────────
// Hash lead_id + first 200 chars of body so n8n retries don't double-process.
async function makeIdempotencyKey(leadId: string, emailBody: string): Promise<string> {
  const raw = `${leadId}:${emailBody.slice(0, 200)}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// ─── Confidence threshold ─────────────────────────────────
// Below this score, the engine does NOT advance state — lead is queued for human review.
// AI classifies; the ENGINE decides whether to act on it.
const CONFIDENCE_THRESHOLD = 0.80;

// ─── Intent → bishop_status mapping ──────────────────────
// Only applied when classification_confidence >= CONFIDENCE_THRESHOLD.
const NEXT_STATE_MAP: Record<string, string> = {
  meeting_pending:     'MEETING_PENDING',
  dnc_list:            'DNC',
  needs_rebuttal:      'FOLLOW_UP_NEEDED',
  // information_request falls through to FOLLOW_UP_NEEDED via the catch-all below
};

// ─── Call Claude API ──────────────────────────────────────

async function classifyReply(
  apiKey: string,
  emailBody: string,
  currentState: string,
): Promise<{
  intent_classification: string;
  classification_confidence: number;
  signature_data: { extracted_phone: string | null; extracted_title: string | null };
  suggested_next_state: string;
}> {
  const systemPrompt = `# ROLE & MANDATE
You are ROOK, the Data Integrity and RevOps microservice.
Your function is to read incoming email replies, classify the intent of the prospect, and extract any structured contact data from their email signature so the CRM can be updated.

# PROCESSING REQUIREMENTS
1. Intent Classification: Analyze the reply and assign ONE of the following strict intents: 'positive_meeting', 'objection_pricing', 'objection_timing', 'unsubscribe', 'information_request', or 'not_interested'.
2. Signature Extraction: Scan the bottom of the email for a signature block. Extract the direct phone number and job title if present.
3. Confidence: Assign a \`confidence_score\` (0.00 to 1.00) to your intent classification.

# STRICT RULES
- Output NOTHING except valid JSON.
- If no phone number or title is found in the signature, return \`null\`. Do not invent data.

# REQUIRED JSON SCHEMA
{
  "intent_classification": "String (Must be one of the exact enums listed above)",
  "classification_confidence": Float,
  "signature_data": {
    "extracted_phone": "String | null",
    "extracted_title": "String | null"
  },
  "suggested_next_state": "String (Either 'meeting_pending', 'dnc_list', or 'needs_rebuttal')"
}`;

  const userMessage = `Email Reply Body: ${emailBody}\nPrevious Lead Status: ${currentState}`;

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    }),
  }, 30_000); // 30s for Claude (longer than CRM calls)

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await response.json();
  const raw  = data.content?.[0]?.text || '';

  // Strip markdown code fences if Claude wraps in ```json
  const cleaned = raw.replace(/^```json\n?/i, '').replace(/```$/m, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${raw}`);
  }

  // Validate required fields
  const validIntents = ['positive_meeting', 'objection_pricing', 'objection_timing', 'unsubscribe', 'information_request', 'not_interested'];
  const validNextStates = ['meeting_pending', 'dnc_list', 'needs_rebuttal'];

  if (!validIntents.includes(parsed.intent_classification)) {
    throw new Error(`Invalid intent: ${parsed.intent_classification}`);
  }
  if (!validNextStates.includes(parsed.suggested_next_state)) {
    // Default to needs_rebuttal if Claude returns something unexpected
    parsed.suggested_next_state = 'needs_rebuttal';
  }

  return parsed;
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
  const ANTHROPIC_API_KEY        = Deno.env.get('ANTHROPIC_API_KEY')!;

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { lead_id, email_body, current_state, client_id } = body;

    if (!lead_id || !email_body || !current_state) {
      return new Response(JSON.stringify({ error: 'lead_id, email_body, current_state required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Email body size guard (prevent Claude cost explosion + DoS) ──
    const MAX_BODY_CHARS = 10_000;
    if (email_body.length > MAX_BODY_CHARS) {
      return new Response(JSON.stringify({ error: `email_body exceeds ${MAX_BODY_CHARS} character limit` }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Idempotency check (prevent double-processing on n8n retry) ──
    const idempotencyKey = await makeIdempotencyKey(lead_id, email_body);
    const { data: existingLog } = await supabase
      .from('rook_reply_logs')
      .select('id, intent_classification, bishop_status_after')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingLog) {
      console.log(`[Rook Reply] Duplicate request detected (idempotency_key: ${idempotencyKey}) — returning cached result`);
      return new Response(JSON.stringify({
        success: true,
        intent_classification: existingLog.intent_classification,
        bishop_status_after: existingLog.bishop_status_after,
        duplicate: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ── Verify lead exists ──────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, email, name, bishop_status, phone, title, client_id')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Classify with Claude ────────────────────────────────
    const classification = await classifyReply(ANTHROPIC_API_KEY, email_body, current_state);
    const {
      intent_classification,
      classification_confidence,
      signature_data,
      suggested_next_state,
    } = classification;

    // ── Build lead update ───────────────────────────────────
    // The ENGINE decides whether to advance state based on confidence threshold.
    // Claude classifies; we only act if confidence is high enough.
    const confidenceGatePassed = classification_confidence >= CONFIDENCE_THRESHOLD;

    // State transition: only apply if confidence gate passed
    const nextBishopStatus = confidenceGatePassed
      ? (NEXT_STATE_MAP[suggested_next_state] || 'FOLLOW_UP_NEEDED')
      : 'REVIEW_NEEDED'; // Low-confidence classifications go to human review queue

    const leadUpdate: Record<string, any> = {
      bishop_status:     nextBishopStatus,
      last_contact_date: new Date().toISOString(),
    };

    // Enrich with signature data if found and not already set
    // Signature extraction is deterministic — no confidence gate needed
    if (signature_data.extracted_phone && !lead.phone) {
      leadUpdate.phone = signature_data.extracted_phone;
    }
    if (signature_data.extracted_title && !lead.title) {
      leadUpdate.title = signature_data.extracted_title;
    }

    // Handle positive meeting interest — transition to PENDING, NOT booked.
    // meeting_booked_at is set only by a confirmed calendar event (calendar webhook / Knight).
    if (intent_classification === 'positive_meeting' && confidenceGatePassed) {
      leadUpdate.status          = 'qualified';
      leadUpdate.next_action_due = null;
      // Do NOT set meeting_booked_at here — that requires calendar confirmation.
    }

    // Handle DNC / unsubscribe — high-stakes: apply even at lower confidence
    // (false negatives on unsubscribe are a compliance risk; false positives are recoverable)
    if (intent_classification === 'unsubscribe' || suggested_next_state === 'dnc_list') {
      leadUpdate.status = 'unsubscribed';
    }

    const { error: updateErr } = await supabase
      .from('leads')
      .update(leadUpdate)
      .eq('id', lead_id);

    const leadUpdated = !updateErr;
    if (updateErr) {
      console.error('[Rook Reply] Lead update failed:', updateErr);
    }

    // ── Log to rook_reply_logs ──────────────────────────────
    // Truncate email_body in log to avoid storing large PII blobs
    const sanitizedBody = email_body.slice(0, 500) + (email_body.length > 500 ? '…[truncated]' : '');
    await supabase.from('rook_reply_logs').insert({
      lead_id,
      email_body:           sanitizedBody,
      intent_classification,
      classification_confidence,
      extracted_phone:      signature_data.extracted_phone,
      extracted_title:      signature_data.extracted_title,
      suggested_next_state,
      bishop_status_before: current_state,
      bishop_status_after:  nextBishopStatus,
      confidence_gate_passed: confidenceGatePassed,
      idempotency_key:      idempotencyKey,
    });

    // ── Auto-trigger CRM sync ───────────────────────────────
    const effectiveClientId = client_id || lead.client_id;
    let crmSynced = false;

    if (effectiveClientId) {
      try {
        const syncRes = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/rook-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            client_id:   effectiveClientId,
            entity_type: 'lead',
            entity_id:   lead_id,
            force:       true, // always re-push after a reply (data changed)
          }),
        });
        const syncData = await syncRes.json();
        crmSynced = syncData.success === true;
      } catch (syncErr) {
        console.warn('[Rook Reply] CRM sync failed (non-fatal):', syncErr);
      }
    }

    console.log(`[Rook Reply] ✓ ${lead.email} | intent: ${intent_classification} (${Math.round(classification_confidence * 100)}%) | gate: ${confidenceGatePassed ? 'PASS' : 'FAIL'} | ${current_state} → ${nextBishopStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        intent_classification,
        classification_confidence,
        confidence_gate_passed: confidenceGatePassed,
        signature_data,
        suggested_next_state,
        bishop_status_before: current_state,
        bishop_status_after:  nextBishopStatus,
        lead_updated:         leadUpdated,
        crm_synced:           crmSynced,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );

  } catch (err) {
    console.error('[Rook Reply] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
