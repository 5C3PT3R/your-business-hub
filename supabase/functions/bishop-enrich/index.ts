/**
 * REGENT: Bishop Enrich Edge Function
 *
 * Scrapes a lead's company website to gather context for
 * personalized email generation by bishop-sweep.
 *
 * POST /functions/v1/bishop-enrich
 * { lead_id: string, user_id: string }
 *
 * Updates leads.enrichment_data + leads.context_notes
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

// ─── Extract company domain from email ────────────────────
function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase();
  // Skip free email providers
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'aol.com', 'protonmail.com', 'live.com',
  ];
  if (freeProviders.includes(domain)) return null;
  return domain;
}

// ─── Scrape company website ────────────────────────────────
async function scrapeCompanySite(domain: string): Promise<{
  title: string;
  description: string;
  summary: string;
} | null> {
  const urls = [`https://${domain}`, `https://www.${domain}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RegentBot/1.0; +https://hireregent.com)',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract meta description
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i)
        || html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract OG description as fallback
      const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i)
        || html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:description["']/i);
      const ogDescription = ogMatch ? ogMatch[1].trim() : '';

      // Strip HTML tags from body text, get first 600 chars
      const bodyText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600);

      const finalDescription = description || ogDescription || bodyText.slice(0, 200);
      if (!title && !finalDescription) continue;

      return {
        title,
        description: finalDescription,
        summary: `${title}${finalDescription ? ' — ' + finalDescription : ''}`.slice(0, 500),
      };
    } catch (_) {
      // Try next URL
    }
  }
  return null;
}

// ─── Main handler ──────────────────────────────────────────
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { lead_id, user_id } = await req.json();

    if (!lead_id || !user_id) {
      return new Response(JSON.stringify({ error: 'lead_id and user_id are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, email, company, enrichment_data, context_notes')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Skip if enriched within the last 7 days
    const existing = lead.enrichment_data as any;
    if (existing?.scraped_at) {
      const scrapedAt = new Date(existing.scraped_at);
      const ageMs = Date.now() - scrapedAt.getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'recently enriched' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const domain = extractDomain(lead.email ?? '');
    if (!domain) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'free email provider' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const scraped = await scrapeCompanySite(domain);
    if (!scraped) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'site unreachable' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const enrichmentData = {
      ...(existing ?? {}),
      company_domain: domain,
      company_title: scraped.title,
      company_description: scraped.description,
      company_summary: scraped.summary,
      scraped_at: new Date().toISOString(),
    };

    // Preserve existing context_notes, append enriched summary
    const newContextNotes = lead.context_notes
      ? `${lead.context_notes}\n\n[Enriched] ${scraped.summary}`
      : `[Enriched] ${scraped.summary}`;

    await supabase
      .from('leads')
      .update({
        enrichment_data: enrichmentData,
        context_notes: newContextNotes.slice(0, 2000),
      })
      .eq('id', lead_id);

    console.log(`[Bishop Enrich] ✓ Enriched lead ${lead_id} from ${domain}`);

    return new Response(
      JSON.stringify({ success: true, domain, summary: scraped.summary }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[Bishop Enrich] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
