/**
 * REGENT: Bishop Send Edge Function
 *
 * Sends an approved AI draft email via Gmail and advances the lead
 * through Bishop's state machine.
 *
 * POST /functions/v1/bishop-send
 *
 * Option A — send a saved draft:
 *   { draft_id: string, user_id: string }
 *
 * Option B — send directly (no pre-saved draft):
 *   { lead_id: string, subject: string, body: string, user_id: string }
 *
 * Returns: {
 *   success: boolean,
 *   gmail_message_id: string,
 *   lead_id: string,
 *   next_bishop_status: string,
 *   next_action_due: string
 * }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   Gmail OAuth tokens stored in DB (via gmail-oauth flow)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getValidGmailToken } from '../_shared/gmail-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Bishop state machine ─────────────────────────────────
// After sending at each stage → next stage
const NEXT_STATUS: Record<string, string> = {
  INTRO_SENT:        'FOLLOW_UP_NEEDED',
  FOLLOW_UP_NEEDED:  'NUDGE_SENT',
  NUDGE_SENT:        'BREAKUP_SENT',
  BREAKUP_SENT:      'BREAKUP_SENT',  // terminal
};

// Days until next action after each send
const NEXT_ACTION_DAYS: Record<string, number> = {
  INTRO_SENT:       2,
  FOLLOW_UP_NEEDED: 3,
  NUDGE_SENT:       4,
  BREAKUP_SENT:     7,
};

// ─── Gmail helpers ────────────────────────────────────────
function buildRawEmail(to: string, from: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    body,
  ].join('\r\n');

  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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
      draft_id,
      lead_id: directLeadId,
      subject: directSubject,
      body: directBody,
      user_id,
    } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let lead: any;
    let subject: string;
    let emailBody: string;
    let draftRecord: any = null;

    // ── Load draft or direct payload ───────────────────────
    if (draft_id) {
      const { data: draft, error: draftErr } = await supabase
        .from('ai_drafts')
        .select('*, leads(id, name, email, bishop_status, workspace_id, client_id)')
        .eq('id', draft_id)
        .single();

      if (draftErr || !draft) {
        return new Response(JSON.stringify({ error: 'Draft not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      if (draft.status === 'SENT') {
        return new Response(JSON.stringify({ error: 'Draft already sent' }), {
          status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      draftRecord = draft;
      lead        = draft.leads;
      subject     = draft.subject;
      emailBody   = draft.plain_text || draft.body;

    } else if (directLeadId && directSubject && directBody) {
      const { data: leadData, error: leadErr } = await supabase
        .from('leads')
        .select('id, name, email, bishop_status, workspace_id, client_id')
        .eq('id', directLeadId)
        .single();

      if (leadErr || !leadData) {
        return new Response(JSON.stringify({ error: 'Lead not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      lead      = leadData;
      subject   = directSubject;
      emailBody = directBody;

    } else {
      return new Response(JSON.stringify({
        error: 'Provide draft_id OR (lead_id + subject + body)',
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!lead?.email) {
      return new Response(JSON.stringify({ error: 'Lead has no email address' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Get Gmail access token ─────────────────────────────
    const gmailToken = await getValidGmailToken(supabase, user_id);
    if (!gmailToken) {
      return new Response(JSON.stringify({ error: 'Gmail not connected — run gmail-oauth first' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Get sender email from Gmail profile ────────────────
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${gmailToken}` },
    });
    if (!profileRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch Gmail profile' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress;

    // ── Send email via Gmail API ───────────────────────────
    const rawEmail = buildRawEmail(lead.email, senderEmail, subject, emailBody);
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEmail }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error('[Bishop Send] Gmail API error:', errText);
      return new Response(JSON.stringify({ error: 'Gmail send failed', details: errText }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const sentMessage = await sendRes.json();
    const gmailMessageId = sentMessage.id;

    // ── Advance Bishop state machine ───────────────────────
    const currentStatus  = lead.bishop_status || 'INTRO_SENT';
    const nextStatus     = NEXT_STATUS[currentStatus] || 'FOLLOW_UP_NEEDED';
    const nextActionDays = NEXT_ACTION_DAYS[currentStatus] || 3;
    const nextActionDue  = new Date(Date.now() + nextActionDays * 86400_000).toISOString();

    await supabase
      .from('leads')
      .update({
        bishop_status:     nextStatus,
        status:            'contacted',
        last_contact_date: new Date().toISOString(),
        next_action_due:   nextActionDue,
        last_email_subject: subject,
      })
      .eq('id', lead.id);

    // ── Update draft status ────────────────────────────────
    if (draftRecord) {
      await supabase
        .from('ai_drafts')
        .update({
          status: 'SENT',
          metadata: {
            ...(draftRecord.metadata || {}),
            gmail_message_id: gmailMessageId,
            sent_at: new Date().toISOString(),
            sent_by: user_id,
          },
        })
        .eq('id', draft_id);
    }

    console.log(`[Bishop Send] ✓ Sent to ${lead.email} | status: ${currentStatus} → ${nextStatus}`);

    return new Response(
      JSON.stringify({
        success:           true,
        gmail_message_id:  gmailMessageId,
        lead_id:           lead.id,
        to:                lead.email,
        prev_bishop_status: currentStatus,
        next_bishop_status: nextStatus,
        next_action_due:   nextActionDue,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[Bishop Send] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
