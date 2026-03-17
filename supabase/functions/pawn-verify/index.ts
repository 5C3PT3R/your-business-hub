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
 * Body (extract mode — AI lead extraction):
 *   {
 *     action: 'extract',
 *     raw_text: string,        // raw scraped web text from any source
 *     source_url?: string,     // optional — recorded in enrichment_data
 *   }
 *   Uses LLM to extract: company name, is_b2b, decision maker, value prop, confidence score.
 *   Returns the structured JSON directly — feed the output into a verify call to gate it.
 *
 * Body (tick mode — pipeline scheduler):
 *   {
 *     action: 'tick',
 *     user_id: string,
 *   }
 *   Returns pipeline health: counts per bishop_status, overdue leads, ready for sweep.
 *   This is Pawn's "figures next action + repeats" role — run it on a schedule or on-demand.
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
 *   OPENAI_API_KEY | DEEPSEEK_API_KEY | OPENROUTER_API_KEY  (required for extract mode)
 *   LLM_PROVIDER: 'openai' | 'deepseek' | 'openrouter'  (default: openai)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ALLOWED_ORIGINS = [
  'https://hireregent.com',
  'https://www.hireregent.com',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

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

  // ── LLM config (shared with bishop-sweep pattern) ────────
  const llmProvider = Deno.env.get('LLM_PROVIDER') || 'openai';
  const llmConfigs: Record<string, { baseURL: string; apiKey: string | undefined; model: string }> = {
    openai:     { baseURL: 'https://api.openai.com/v1',         apiKey: Deno.env.get('OPENAI_API_KEY'),     model: 'gpt-4o-mini' },
    deepseek:   { baseURL: 'https://api.deepseek.com/v1',       apiKey: Deno.env.get('DEEPSEEK_API_KEY'),   model: 'deepseek-chat' },
    openrouter: { baseURL: 'https://openrouter.ai/api/v1',      apiKey: Deno.env.get('OPENROUTER_API_KEY'), model: 'openai/gpt-4o-mini' },
  };
  const llm = llmConfigs[llmProvider] ?? llmConfigs['openai'];

  const startedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      action,
      leads: rawLeads,
      domains,
      client_id,
      workspace_id,
      user_id,
    } = body;

    // ── Extract mode: AI lead extraction from raw text ────
    // Takes raw scraped web text, returns structured B2B lead data.
    // Feed the output directly into a verify call to gate the lead.
    if (action === 'extract') {
      const { raw_text, source_url } = body;

      if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 20) {
        return new Response(JSON.stringify({ error: 'raw_text is required and must be non-trivial' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!llm.apiKey) {
        return new Response(JSON.stringify({
          error: `LLM API key not set. Add ${llmProvider.toUpperCase()}_API_KEY to Supabase secrets.`,
        }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const SYSTEM_PROMPT = `You are PAWN, the Lead Verification microservice for the Regent BPO Engine.
Your sole function is to process raw scraped web text, extract target B2B information, and output strictly formatted JSON. You do not make business decisions; you only provide structured data and confidence scores.

# EXTRACTION REQUIREMENTS
1. Identify if the company is a B2B SaaS or B2B Service business.
2. Extract the name of the primary decision-maker (CEO, Founder, or VP level).
3. Extract the core value proposition of the company in under 10 words.
4. Calculate a confidence_score (0.00 to 1.00) indicating how certain you are that the extracted decision-maker is accurate based on the text.

# STRICT RULES
- Output NOTHING except valid JSON. No markdown formatting, no explanations, no conversational text.
- If a data point cannot be found, return null for that field.
- Do not hallucinate or guess. Base extraction ONLY on the provided input text.

# REQUIRED JSON SCHEMA
{
  "company_clean_name": "String",
  "is_b2b": Boolean,
  "decision_maker_extracted": "String | null",
  "decision_maker_title": "String | null",
  "core_value_prop": "String | null",
  "confidence_score": Float
}`;

      try {
        const llmRes = await fetch(`${llm.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llm.apiKey}`,
          },
          body: JSON.stringify({
            model: llm.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Raw Scraped Text:\n${raw_text.slice(0, 8000)}` },
            ],
            temperature: 0,
            max_tokens: 300,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (!llmRes.ok) {
          const err = await llmRes.text();
          console.error('[Pawn] LLM error:', llmRes.status, err.slice(0, 200));
          return new Response(JSON.stringify({ error: `LLM request failed: ${llmRes.status}` }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const llmData = await llmRes.json();
        const rawContent: string = llmData.choices?.[0]?.message?.content?.trim() ?? '';

        // Strip any accidental markdown fences
        const jsonStr = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        let extracted: Record<string, unknown>;
        try {
          extracted = JSON.parse(jsonStr);
        } catch {
          console.error('[Pawn] JSON parse failed. Raw content:', rawContent.slice(0, 300));
          return new Response(JSON.stringify({
            error: 'LLM returned non-JSON output',
            raw: rawContent.slice(0, 300),
          }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        return new Response(
          JSON.stringify({
            ...extracted,
            source_url: source_url || null,
            extracted_at: new Date().toISOString(),
            model_used: llm.model,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

      } catch (err) {
        console.error('[Pawn] Extract error:', err);
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ── Tick mode: pipeline scheduler ─────────────────────
    // Scans all active leads, figures out what's overdue, returns pipeline health.
    // This is Pawn's "figures next action + repeats" role.
    if (action === 'tick') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required for tick' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Run both queries in parallel: active leads + booked count
      const [activeRes, bookedRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, name, email, company, bishop_status, next_action_due, last_contact_date')
          .eq('user_id', user_id)
          .is('meeting_booked_at', null),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user_id)
          .not('meeting_booked_at', 'is', null),
      ]);

      if (activeRes.error) {
        return new Response(JSON.stringify({ error: activeRes.error.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const now = new Date();
      const TERMINAL = new Set(['BREAKUP_SENT', 'ESCALATE_TO_KING']);
      const bookedCount = bookedRes.count ?? 0;

      const pipeline: Record<string, number> = {
        NEW: 0,
        INTRO_SENT: 0,
        FOLLOW_UP_NEEDED: 0,
        NUDGE_SENT: 0,
        BREAKUP_SENT: 0,
        booked: bookedCount,
      };

      const overdueLeads: any[] = [];

      for (const lead of activeRes.data || []) {
        const status: string = lead.bishop_status || 'NEW';
        if (status in pipeline) pipeline[status]++;
        else pipeline['NEW']++;

        if (!TERMINAL.has(status)) {
          const nextDue = lead.next_action_due ? new Date(lead.next_action_due) : now;
          if (nextDue <= now) {
            overdueLeads.push({
              id: lead.id,
              name: lead.name,
              email: lead.email,
              company: lead.company,
              bishop_status: status,
              next_action_due: lead.next_action_due,
              last_contact_date: lead.last_contact_date,
            });
          }
        }
      }

      // total_active excludes booked (they're done)
      const { booked: _b, ...activePipeline } = pipeline;
      const totalActive = Object.values(activePipeline).reduce((a, b) => a + b, 0);

      // ── Auto-verify: gate NEW leads that Bishop sourced ────
      // NEW leads haven't been emailed yet — safe to remove invalids now.
      const newLeads = (activeRes.data || []).filter(l => (l.bishop_status || 'NEW') === 'NEW');
      const idsToRemove: string[] = [];
      for (const lead of newLeads) {
        if (!isValidEmail(lead.email)) {
          idsToRemove.push(lead.id);
        }
      }
      let autoRemoved = 0;
      if (idsToRemove.length > 0) {
        const { error: delErr } = await supabase.from('leads').delete().in('id', idsToRemove);
        if (!delErr) {
          autoRemoved = idsToRemove.length;
          pipeline['NEW'] = Math.max(0, pipeline['NEW'] - autoRemoved);
        }
      }

      return new Response(
        JSON.stringify({
          pipeline,
          total_active: Math.max(0, totalActive - autoRemoved),
          overdue: overdueLeads.length,
          overdue_leads: overdueLeads,
          ready_for_sweep: overdueLeads.length,
          auto_verified: { checked: newLeads.length, removed: autoRemoved },
          scanned_at: now.toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ── Report mode: cross-agent BI analysis ───────────────
    // Aggregates data from Bishop (leads/drafts), Knight (tickets), Rook (syncs),
    // and Pawn (jobs) to surface loopholes and growth opportunities.
    if (action === 'report') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required for report' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      function extractSource(url: string | null): string {
        if (!url) return 'Direct / Unknown';
        const u = url.toLowerCase();
        if (u.includes('apollo')) return 'Apollo';
        if (u.includes('hunter')) return 'Hunter.io';
        if (u.includes('producthunt') || u.includes('product-hunt')) return 'Product Hunt';
        if (u.includes('ycombinator') || u.includes('hacker')) return 'Hacker News';
        if (u.includes('linkedin')) return 'LinkedIn';
        try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Other'; }
      }

      // 1. Fetch all data in parallel
      const [leadsRes, draftsRes, pawnJobsRes, workspaceRes] = await Promise.all([
        supabase.from('leads').select('id, title, source_url, company, bishop_status, meeting_booked_at, created_at').eq('user_id', user_id),
        supabase.from('ai_drafts').select('id, status, created_at').eq('user_id', user_id),
        supabase.from('pawn_jobs').select('clean, duplicates, invalid, job_type, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('workspace_memberships').select('workspace_id').eq('user_id', user_id).limit(1),
      ]);

      const leads = leadsRes.data || [];
      const drafts = draftsRes.data || [];
      const pawnJobs = pawnJobsRes.data || [];

      // 2. Get tickets via workspace
      const workspaceId = workspaceRes.data?.[0]?.workspace_id;
      let tickets: any[] = [];
      let ticketMessages: any[] = [];
      if (workspaceId) {
        const [tRes, tmRes] = await Promise.all([
          supabase.from('tickets').select('id, source_channel, status, sentiment_score, summary').eq('workspace_id', workspaceId).limit(200),
          supabase.from('ticket_messages').select('content, sender_type, ticket_id').eq('sender_type', 'user').limit(500),
        ]);
        tickets = tRes.data || [];
        ticketMessages = tmRes.data || [];
      }

      // 3. Lead source breakdown
      type StatBucket = { total: number; booked: number };
      const sourceMap: Record<string, StatBucket> = {};
      const roleMap: Record<string, StatBucket> = {};
      const funnel: Record<string, number> = { NEW: 0, INTRO_SENT: 0, FOLLOW_UP_NEEDED: 0, NUDGE_SENT: 0, BREAKUP_SENT: 0, booked: 0 };

      for (const lead of leads) {
        const src = extractSource(lead.source_url);
        if (!sourceMap[src]) sourceMap[src] = { total: 0, booked: 0 };
        sourceMap[src].total++;
        if (lead.meeting_booked_at) sourceMap[src].booked++;

        const role = (lead.title || 'Unknown').trim() || 'Unknown';
        if (!roleMap[role]) roleMap[role] = { total: 0, booked: 0 };
        roleMap[role].total++;
        if (lead.meeting_booked_at) roleMap[role].booked++;

        if (lead.meeting_booked_at) funnel.booked++;
        else {
          const s = lead.bishop_status || 'NEW';
          if (s in funnel) funnel[s]++;
        }
      }

      const source_breakdown = Object.entries(sourceMap)
        .map(([source, { total, booked }]) => ({ source, total, booked, rate: total > 0 ? Math.round(booked / total * 1000) / 10 : 0 }))
        .filter(x => x.total >= 2)
        .sort((a, b) => b.rate - a.rate);

      const role_breakdown = Object.entries(roleMap)
        .map(([role, { total, booked }]) => ({ role, total, booked, rate: total > 0 ? Math.round(booked / total * 1000) / 10 : 0 }))
        .filter(x => x.total >= 3)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 10);

      // 4. Funnel drop-off
      const funnelSteps = ['NEW', 'INTRO_SENT', 'FOLLOW_UP_NEEDED', 'NUDGE_SENT', 'BREAKUP_SENT'];
      let biggestDrop = { from: '', to: '', pct: 0 };
      for (let i = 0; i < funnelSteps.length - 1; i++) {
        const a = funnel[funnelSteps[i]], b = funnel[funnelSteps[i + 1]];
        if (a > 0) { const pct = Math.round((a - b) / a * 100); if (pct > biggestDrop.pct) biggestDrop = { from: funnelSteps[i], to: funnelSteps[i + 1], pct }; }
      }

      // 5. Ticket channel + sentiment breakdown
      const channelMap: Record<string, { tickets: number; resolved: number; sentimentSum: number; sentimentCount: number }> = {};
      for (const t of tickets) {
        const ch = t.source_channel || 'unknown';
        if (!channelMap[ch]) channelMap[ch] = { tickets: 0, resolved: 0, sentimentSum: 0, sentimentCount: 0 };
        channelMap[ch].tickets++;
        if (t.status === 'resolved') channelMap[ch].resolved++;
        if (t.sentiment_score) { channelMap[ch].sentimentSum += t.sentiment_score; channelMap[ch].sentimentCount++; }
      }
      const channel_breakdown = Object.entries(channelMap).map(([channel, v]) => ({
        channel,
        tickets: v.tickets,
        resolved: v.resolved,
        resolution_rate: v.tickets > 0 ? Math.round(v.resolved / v.tickets * 100) : 0,
        avg_sentiment: v.sentimentCount > 0 ? Math.round(v.sentimentSum / v.sentimentCount * 10) / 10 : null,
      })).sort((a, b) => b.tickets - a.tickets);

      // 6. Complaint topic extraction (keyword frequency from customer messages)
      const STOP = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','but','not','with','my','i','we','our','your','have','has','been','was','are','be','this','that','can','will','would','could','should','do','does','did','get','got','how','why','when','where','what','who','which','please','hi','hello','dear','thank','thanks','just','also','very','really','still','already','now','need','want','use','using','used','like','make','help','know','see','try','tried','cant','dont','doesnt','isnt','from']);
      const topicFreq: Record<string, number> = {};
      for (const msg of ticketMessages) {
        const words = (msg.content || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w: string) => w.length > 3 && !STOP.has(w));
        for (const w of words) topicFreq[w] = (topicFreq[w] || 0) + 1;
      }
      const complaint_topics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

      // 7. Draft stats
      const sentDrafts = drafts.filter(d => d.status === 'sent').length;
      const pendingDrafts = drafts.filter(d => d.status === 'pending').length;

      // 8. Pawn stats
      const totalVerified = pawnJobs.reduce((a, j) => a + (j.clean ?? 0), 0);
      const totalBlocked = pawnJobs.reduce((a, j) => a + (j.duplicates ?? 0) + (j.invalid ?? 0), 0);

      // 9. Generate loopholes
      const totalLeads = leads.length;
      const totalBooked = leads.filter(l => l.meeting_booked_at).length;
      const overallRate = totalLeads > 0 ? Math.round(totalBooked / totalLeads * 1000) / 10 : 0;
      const loopholes: string[] = [];

      const best = source_breakdown[0], worst = source_breakdown[source_breakdown.length - 1];
      if (best && worst && best.source !== worst.source && best.total >= 5 && worst.total >= 5) {
        loopholes.push(`${best.source} converts at ${best.rate}% vs ${worst.source} at ${worst.rate}%. Shift prospecting budget toward ${best.source}.`);
      }
      if (biggestDrop.pct > 35) {
        loopholes.push(`${biggestDrop.pct}% of leads drop off between ${biggestDrop.from} → ${biggestDrop.to}. This is your biggest sequence leak — review the email copy at this stage.`);
      }
      const zeroRoles = role_breakdown.filter(r => r.rate === 0 && r.total >= 5);
      if (zeroRoles.length > 0) {
        loopholes.push(`${zeroRoles.map(r => r.role).join(', ')} titles have 0% conversion (${zeroRoles.reduce((a, r) => a + r.total, 0)} leads). These roles don't buy — stop targeting them or change your value prop.`);
      }
      if (overallRate < 2 && totalLeads > 20) {
        loopholes.push(`Booking rate is ${overallRate}% — below the 2-5% cold email average. Your ICP, subject line, or CTA needs testing.`);
      }
      const lowSentChannel = channel_breakdown.find(c => c.avg_sentiment !== null && c.avg_sentiment < 5 && c.tickets >= 5);
      if (lowSentChannel) {
        loopholes.push(`Knight's ${lowSentChannel.channel} channel has an avg sentiment of ${lowSentChannel.avg_sentiment}/10. Customers are consistently unhappy there — investigate response quality or speed.`);
      }
      const unresolved = channel_breakdown.find(c => c.resolution_rate < 50 && c.tickets >= 5);
      if (unresolved) {
        loopholes.push(`${unresolved.channel} tickets have a ${unresolved.resolution_rate}% resolution rate. More than half aren't being resolved — Knight's playbook for that channel needs work.`);
      }
      if (complaint_topics.length > 0) {
        loopholes.push(`Top complaint keywords from customers: "${complaint_topics.slice(0, 3).map(t => t.word).join('", "')}". These are your biggest pain points to address.`);
      }
      const bestRole = role_breakdown.find(r => r.rate > 10 && r.total >= 5);
      if (bestRole) {
        loopholes.push(`${bestRole.role}s convert at ${bestRole.rate}% (${bestRole.booked}/${bestRole.total}). This is your sweet spot — prospect more of this title.`);
      }
      if (loopholes.length === 0) {
        loopholes.push('Not enough data yet to surface specific loopholes. Add more leads and let Bishop run sequences to generate insights.');
      }

      // 10. LLM narrative (if API key available)
      let narrative: string | null = null;
      if (llm.apiKey && totalLeads > 0) {
        const statsForLlm = {
          total_leads: totalLeads, total_booked: totalBooked, overall_rate: overallRate,
          best_source: best ? `${best.source} (${best.rate}%)` : null,
          worst_source: worst && worst !== best ? `${worst.source} (${worst.rate}%)` : null,
          best_role: bestRole ? `${bestRole.role} (${bestRole.rate}%)` : null,
          zero_roles: zeroRoles.map(r => r.role),
          biggest_funnel_drop: biggestDrop.pct > 0 ? `${biggestDrop.from}→${biggestDrop.to} (${biggestDrop.pct}% drop)` : null,
          sent_emails: sentDrafts, pending_drafts: pendingDrafts,
          total_tickets: tickets.length, open_tickets: tickets.filter(t => t.status === 'open').length,
          top_complaint_words: complaint_topics.slice(0, 5).map(t => t.word),
          channel_with_low_sentiment: lowSentChannel?.channel || null,
        };
        try {
          const llmRes = await fetch(`${llm.baseURL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llm.apiKey}` },
            body: JSON.stringify({
              model: llm.model,
              messages: [
                { role: 'system', content: 'You are a sharp B2B sales analyst advising the founder of an early-stage SaaS company. Given pipeline and support data, write 3-4 sentences of specific, actionable business advice. Focus on: (1) the single biggest growth opportunity, (2) the single biggest leak to plug. Use exact numbers. Be direct — no fluff, no "great job", no filler.' },
                { role: 'user', content: `Business data: ${JSON.stringify(statsForLlm)}` },
              ],
              max_tokens: 220, temperature: 0.3,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (llmRes.ok) {
            const d = await llmRes.json();
            narrative = d.choices?.[0]?.message?.content?.trim() || null;
          }
        } catch (_) { /* narrative stays null */ }
      }

      return new Response(JSON.stringify({
        source_breakdown,
        role_breakdown,
        funnel,
        channel_breakdown,
        complaint_topics,
        loopholes,
        narrative,
        totals: { leads: totalLeads, booked: totalBooked, rate: overallRate, sent_emails: sentDrafts, tickets: tickets.length, verified: totalVerified, blocked: totalBlocked },
        generated_at: new Date().toISOString(),
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

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
      // Guard: lead must be a plain object with an email field
      if (!lead || typeof lead !== 'object' || Array.isArray(lead)) {
        invalid.push({ _raw: String(lead), _reason: 'invalid_lead_format' });
        continue;
      }
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
