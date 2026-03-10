/**
 * REGENT: Bishop Prospect Edge Function
 *
 * Multi-source lead sourcing for Bishop's SDR pipeline.
 * Sources leads from Apollo, Hunter, Product Hunt, Hacker News,
 * or a custom URL — then validates + deduplicates via pawn-verify.
 *
 * POST /functions/v1/bishop-prospect
 * {
 *   user_id: string,
 *   sources: string[],       // ['apollo','hunter','product_hunt','hacker_news','url']
 *   icp: {
 *     titles: string[],      // ['Founder','CEO','CTO']
 *     industries: string[],  // ['SaaS','B2B Software']
 *     company_size_max: number, // default 200
 *     locations: string[],   // ['United States','Canada']
 *     keywords: string[],    // ['bootstrapped','seed']
 *     target_url: string     // for 'url' source
 *   }
 * }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APOLLO_API_KEY     (optional — Apollo source)
 *   HUNTER_API_KEY     (optional — Hunter source)
 *   PRODUCT_HUNT_TOKEN (optional — Product Hunt source, free dev token)
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

interface ICP {
  titles: string[];
  industries: string[];
  company_size_max: number;
  locations: string[];
  keywords: string[];
  target_url?: string;
}

interface RawLead {
  name: string;
  email: string;
  company: string;
  title?: string;
  linkedin_url?: string;
  source_url?: string;
  context_notes?: string;
  enrichment_data?: Record<string, any>;
}

// ─── Apollo.io ────────────────────────────────────────────
async function sourceApollo(icp: ICP): Promise<RawLead[]> {
  const apiKey = Deno.env.get('APOLLO_API_KEY');
  if (!apiKey) {
    console.warn('[Prospect] Apollo API key not set — skipping');
    return [];
  }

  try {
    const payload: any = {
      per_page: 25,
      page: 1,
    };
    if (icp.titles.length > 0) payload.person_titles = icp.titles;
    if (icp.locations.length > 0) payload.person_locations = icp.locations;
    if (icp.company_size_max > 0) {
      payload.organization_num_employees_ranges = [`1,${icp.company_size_max}`];
    }
    if (icp.industries.length > 0) payload.organization_industries = icp.industries;
    if (icp.keywords.length > 0) payload.q_keywords = icp.keywords.join(' ');

    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Prospect] Apollo error:', res.status, err);
      return [];
    }

    const data = await res.json();
    const people: any[] = data.people || [];
    console.log(`[Prospect] Apollo returned ${people.length} people, ${people.filter((p:any) => p.email).length} with emails`);

    return people
      .filter((p: any) => p.first_name && (p.email || p.organization?.primary_domain))
      .map((p: any) => {
        const domain = p.organization?.primary_domain;
        // If no email, guess from domain: firstname@domain.com
        const email = p.email || (domain
          ? `${p.first_name.toLowerCase().replace(/[^a-z]/g,'')}@${domain}`
          : null);
        if (!email) return null;
        return {
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        email,
        company: p.organization?.name || p.employment_history?.[0]?.organization_name || '',
        title: p.title || '',
        linkedin_url: p.linkedin_url || '',
        source_url: `https://app.apollo.io/#/people/${p.id}`,
        context_notes: `Apollo: ${p.title || 'Unknown title'} at ${p.organization?.name || 'Unknown company'}`,
        enrichment_data: {
          apollo_id: p.id,
          company_size: p.organization?.num_employees,
          industry: p.organization?.industry,
          funding: p.organization?.funding_events?.[0]?.type,
        },
      };}).filter(Boolean) as RawLead[];
  } catch (err) {
    console.error('[Prospect] Apollo fetch error:', err);
    return [];
  }
}

// ─── Hunter.io ────────────────────────────────────────────
async function sourceHunter(icp: ICP): Promise<RawLead[]> {
  const apiKey = Deno.env.get('HUNTER_API_KEY');
  if (!apiKey) {
    console.warn('[Prospect] Hunter API key not set — skipping');
    return [];
  }

  // Hunter works per-domain — use keyword-based company search if no specific domains
  const searchTerms = icp.keywords.length > 0 ? icp.keywords : icp.industries.slice(0, 3);
  if (searchTerms.length === 0) {
    console.warn('[Prospect] Hunter source requires keywords or industries to search');
    return [];
  }

  const leads: RawLead[] = [];

  for (const term of searchTerms.slice(0, 3)) {
    try {
      const url = `https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(term)}&api_key=${apiKey}&limit=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      const data = await res.json();
      const domain = data.data?.domain;
      const company = data.data?.organization || term;
      const emails: any[] = data.data?.emails || [];

      for (const e of emails) {
        if (!e.value || !e.first_name) continue;
        // Filter by target titles if specified
        if (icp.titles.length > 0) {
          const titleMatch = icp.titles.some(t =>
            (e.position || '').toLowerCase().includes(t.toLowerCase())
          );
          if (!titleMatch) continue;
        }
        leads.push({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          email: e.value,
          company,
          title: e.position || '',
          linkedin_url: e.linkedin || '',
          source_url: `https://${domain}`,
          context_notes: `Hunter: ${e.position || 'Unknown role'} at ${company}`,
          enrichment_data: { company_domain: domain, hunter_confidence: e.confidence },
        });
      }
    } catch (err) {
      console.error('[Prospect] Hunter error for term', term, err);
    }
  }

  return leads;
}

// ─── Product Hunt (free) ──────────────────────────────────
async function sourceProductHunt(): Promise<RawLead[]> {
  const token = Deno.env.get('PRODUCT_HUNT_TOKEN');
  const hunterKey = Deno.env.get('HUNTER_API_KEY');

  // No topic filter — get newest across all categories
  const query = `{
    posts(first: 30, order: NEWEST) {
      nodes {
        name
        tagline
        slug
        url
        makers {
          name
          username
          headline
          twitterUsername
        }
      }
    }
  }`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Prospect] Product Hunt HTTP error:', res.status, errText.slice(0, 200));
      return [];
    }

    const data = await res.json();
    if (data.errors) {
      console.error('[Prospect] Product Hunt GraphQL errors:', JSON.stringify(data.errors).slice(0, 300));
      return [];
    }

    const posts: any[] = data.data?.posts?.nodes || [];
    console.log(`[Prospect] Product Hunt returned ${posts.length} posts`);
    const leads: RawLead[] = [];

    for (const post of posts) {
      // Derive domain from slug, then product name as fallback
      let productDomain = '';

      if (!productDomain && post.slug) {
        // e.g. slug = "my-cool-app" → try mycoolapp.com, my-cool-app.com
        const slug = post.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const slugNoDash = slug.replace(/-/g, '');
        productDomain = slugNoDash.length > 2 ? `${slugNoDash}.com` : '';
      }

      // Fallback: derive from product name
      if (!productDomain && post.name) {
        const nameSlug = post.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameSlug.length > 2) productDomain = `${nameSlug}.com`;
      }

      for (const maker of (post.makers || [])) {
        if (!maker.name) continue; // only require a name
        const profileUrl = `https://www.producthunt.com/@${maker.username}`;

        // Try Hunter email-finder if we have a real domain
        let email = '';
        if (hunterKey && productDomain) {
          try {
            const nameParts = maker.name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            const hunterRes = await fetch(
              `https://api.hunter.io/v2/email-finder?domain=${productDomain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${hunterKey}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (hunterRes.ok) {
              const hunterData = await hunterRes.json();
              email = hunterData.data?.email || '';
            }
          } catch {}
        }

        // Do NOT guess emails from slug-derived domains — they almost always bounce.
        // PH leads are only included when Hunter.io confirmed a real email.
        if (!email) continue;

        leads.push({
          name: maker.name,
          email,
          company: post.name || '',
          title: maker.headline || 'Maker',
          linkedin_url: profileUrl,
          source_url: post.url,
          context_notes: `Product Hunt maker${maker.headline ? ': ' + maker.headline : ''} — built "${post.name}": ${post.tagline}`,
          enrichment_data: {
            product_hunt_username: maker.username,
            product_name: post.name,
            product_tagline: post.tagline,
            twitter: maker.twitterUsername,
            product_domain: productDomain,
            domain_source: 'guessed',
          },
        });
      }
    }

    console.log(`[Prospect] Product Hunt extracted ${leads.length} leads from ${posts.length} posts`);
    return leads;
  } catch (err) {
    console.error('[Prospect] Product Hunt error:', err);
    return [];
  }
}

// ─── Hacker News "Who is Hiring" ──────────────────────────
async function sourceHackerNews(icp: ICP): Promise<RawLead[]> {
  try {
    // Find the most recent "Ask HN: Who is Hiring?" post
    const searchRes = await fetch(
      'https://hn.algolia.com/api/v1/search?query=Ask+HN%3A+Who+is+hiring&tags=ask_hn&hitsPerPage=3',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const topPost = searchData.hits?.[0];
    if (!topPost) return [];

    const postId = topPost.objectID;

    // Get comments for this post
    const commentsRes = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${postId}&hitsPerPage=50`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!commentsRes.ok) return [];

    const commentsData = await commentsRes.json();
    const comments: any[] = commentsData.hits || [];

    const leads: RawLead[] = [];
    const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

    for (const comment of comments) {
      const text: string = comment.comment_text || '';
      if (!text) continue;

      // Extract emails from comment first — only process if there's an email
      const emails = text.match(emailRegex) || [];
      if (emails.length === 0) continue;

      // Extract company name — HN format is "CompanyName | Location | Role | ..."
      const firstLine = text.replace(/<[^>]+>/g, '').split('\n')[0];
      // Take segment before first | as company name
      const beforePipe = firstLine.split('|')[0].trim();
      const company = (beforePipe.length > 2 && beforePipe.length < 60)
        ? beforePipe
        : firstLine.slice(0, 50).trim();

      for (const email of emails.slice(0, 2)) {
        leads.push({
          name: '',  // Unknown from HN
          email,
          company: company.slice(0, 100),
          title: '',
          source_url: `https://news.ycombinator.com/item?id=${postId}`,
          context_notes: `Hacker News "Who is Hiring": ${firstLine.slice(0, 200)}`,
          enrichment_data: {
            hn_post_id: postId,
            comment_id: comment.objectID,
          },
        });
      }
    }

    return leads;
  } catch (err) {
    console.error('[Prospect] HN error:', err);
    return [];
  }
}

// ─── Custom URL scraper ───────────────────────────────────
async function sourceCustomUrl(url: string): Promise<RawLead[]> {
  if (!url) return [];

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RegentBot/1.0)',
        Accept: 'text/html,text/plain',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return [];

    const text = await res.text();
    const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
    const emails = [...new Set(text.match(emailRegex) || [])];

    // Try to extract name hints near each email
    const leads: RawLead[] = [];
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

    for (const email of emails.slice(0, 50)) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) continue;

      // Try to find nearby name context
      const emailIdx = text.indexOf(email);
      const surroundingText = text.slice(Math.max(0, emailIdx - 100), emailIdx + 100)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      leads.push({
        name: '',
        email,
        company: freeProviders.includes(domain) ? '' : domain.replace(/^www\./, ''),
        title: '',
        source_url: url,
        context_notes: `Scraped from ${url}: ${surroundingText.slice(0, 200)}`,
        enrichment_data: { source_url: url },
      });
    }

    return leads;
  } catch (err) {
    console.error('[Prospect] Custom URL error:', err);
    return [];
  }
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
    const body = await req.json();
    const { user_id, sources = [], icp = {}, force_refresh = false } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // force_refresh is handled below at the upsert stage — no pre-delete needed.

    const icpConfig: ICP = {
      titles: icp.titles || [],
      industries: icp.industries || [],
      company_size_max: icp.company_size_max || 200,
      locations: icp.locations || [],
      keywords: icp.keywords || [],
      target_url: icp.target_url || '',
    };

    const enabledSources: string[] = sources.length > 0
      ? sources
      : ['product_hunt', 'hacker_news'];

    // Run all enabled sources in parallel with per-source tracking
    const sourceTasks: { name: string; promise: Promise<RawLead[]> }[] = [];
    if (enabledSources.includes('apollo')) sourceTasks.push({ name: 'apollo', promise: sourceApollo(icpConfig) });
    if (enabledSources.includes('hunter')) sourceTasks.push({ name: 'hunter', promise: sourceHunter(icpConfig) });
    if (enabledSources.includes('product_hunt')) sourceTasks.push({ name: 'product_hunt', promise: sourceProductHunt() });
    if (enabledSources.includes('hacker_news')) sourceTasks.push({ name: 'hacker_news', promise: sourceHackerNews(icpConfig) });
    if (enabledSources.includes('url') && icpConfig.target_url) {
      sourceTasks.push({ name: 'url', promise: sourceCustomUrl(icpConfig.target_url) });
    }

    const results = await Promise.allSettled(sourceTasks.map(t => t.promise));
    const sourceBreakdown: Record<string, number> = {};
    const allLeads: RawLead[] = results.flatMap((r, i) => {
      const name = sourceTasks[i].name;
      const leads = r.status === 'fulfilled' ? r.value : [];
      sourceBreakdown[name] = leads.length;
      if (r.status === 'rejected') console.error(`[Prospect] ${name} failed:`, r.reason);
      return leads;
    });

    console.log(`[Prospect] Per-source: ${JSON.stringify(sourceBreakdown)}`);

    if (allLeads.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        stats: { total: 0, clean: 0, duplicates: 0, invalid: 0, inserted: 0 },
        source_breakdown: sourceBreakdown,
        message: `No leads found. Per source: ${JSON.stringify(sourceBreakdown)}`,
      }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get workspace_id (best-effort)
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user_id)
      .limit(1)
      .maybeSingle();
    const workspaceId: string | null = membership?.workspace_id ?? null;

    // ── Inline validation + dedup + insert ────────────────
    const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    const BLOCKED = new Set(['mailinator.com','guerrillamail.com','tempmail.com',
      'yopmail.com','10minutemail.com','trashmail.com','fakeinbox.com',
      'placeholder.producthunt','sharklasers.com','spam4.me','dispostable.com']);

    const validLeads = allLeads.filter(l => {
      if (!l.email || !EMAIL_RE.test(l.email.trim())) return false;
      const domain = l.email.split('@')[1]?.toLowerCase() ?? '';
      return !BLOCKED.has(domain);
    }).map(l => ({ ...l, email: l.email.trim().toLowerCase() }));

    const invalidCount = allLeads.length - validLeads.length;

    // ── Dedup (skipped on force_refresh) ──────────────────
    let leadsToWrite = validLeads;
    let duplicateCount = 0;

    if (!force_refresh) {
      // Normal mode: skip emails already in the pipeline
      let existingEmails = new Set<string>();
      if (validLeads.length > 0) {
        const emails = validLeads.map(l => l.email);
        const { data: existing } = await supabase
          .from('leads')
          .select('email')
          .in('email', emails)
          .eq('user_id', user_id);
        existingEmails = new Set((existing || []).map((r: any) => r.email));
      }
      leadsToWrite = validLeads.filter(l => !existingEmails.has(l.email));
      duplicateCount = validLeads.length - leadsToWrite.length;
    }

    // ── Upsert ─────────────────────────────────────────────
    // force_refresh uses upsert — existing leads are reset to NEW status.
    // Normal mode uses insert (skips dupes via dedup above).
    let inserted = 0;
    if (leadsToWrite.length > 0) {
      const now = new Date().toISOString();
      const toWrite = leadsToWrite.map(l => ({
        name:              l.name || null,
        email:             l.email,
        company:           l.company || null,
        source:            'web_scrape',
        status:            'new',
        bishop_status:     'NEW',
        user_id,
        workspace_id:      workspaceId,
        context_notes:     l.context_notes || null,
        enrichment_data:   l.enrichment_data || {},
        last_contact_date: null,
        next_action_due:   now,
      }));

      const upsertOpts = force_refresh
        ? { onConflict: 'email,user_id', ignoreDuplicates: false }  // reset existing rows
        : undefined;

      const op = force_refresh
        ? supabase.from('leads').upsert(toWrite, upsertOpts!)
        : supabase.from('leads').insert(toWrite);

      const { error: writeErr } = await op;
      if (writeErr) {
        console.error('[Prospect] Write error:', writeErr.message);
        // Retry without workspace_id (FK constraint fallback)
        const fallback = toWrite.map(({ workspace_id: _ws, ...l }) => l);
        const fallbackOp = force_refresh
          ? supabase.from('leads').upsert(fallback, upsertOpts!)
          : supabase.from('leads').insert(fallback);
        const { error: fallbackErr } = await fallbackOp;
        if (!fallbackErr) {
          inserted = leadsToWrite.length;
        } else {
          console.error('[Prospect] Fallback also failed:', fallbackErr.message);
          return new Response(JSON.stringify({
            success: false,
            error: `Write failed: ${fallbackErr.message}`,
            stats: { total: allLeads.length, clean: leadsToWrite.length, duplicates: duplicateCount, invalid: invalidCount, inserted: 0 },
          }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      } else {
        inserted = leadsToWrite.length;
      }
    }

    const stats = {
      total:      allLeads.length,
      clean:      newLeads.length,
      duplicates: duplicateCount,
      invalid:    invalidCount,
      inserted,
    };
    console.log('[Prospect] Done:', stats);

    return new Response(
      JSON.stringify({ success: true, sources_used: enabledSources, stats, source_breakdown: sourceBreakdown }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[Prospect] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
