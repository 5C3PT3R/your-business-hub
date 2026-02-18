// ============================================
// BISHOP — Icebreaker Router (JSON Brain)
// ============================================
// Reads the lead's campaign_id from the Supabase trigger
// and returns the matching campaign config + lead data.

// ── THE JSON BRAIN ──────────────────────────
// Source of truth: hireregent.com landing page
const CAMPAIGNS = [
  {
    campaign_id: 'regent_customer_support',
    campaign_name: 'Regent — AI Customer Support',
    client: 'Regent',
    product: 'Customer Support Agent (Knight)',
    // ── FROM THE LANDING PAGE ──
    headline: 'Grandmaster your Ops.',
    tagline: 'Every company plays a game. Most play without a system. Regent deploys autonomous AI agents to checkmate your operational inefficiency.',
    positioning: 'Humans for strategy. AI for execution.',
    how_it_works: '1) Ingest & Learn — Builds a dynamic knowledge graph of your company. 2) Autonomous Run — Executes tasks with 99.9% uptime and zero latency. 3) Human Oversight — Edge cases are routed to supervisors for review.',
    // ── SOLUTION-SPECIFIC ──
    target_persona: 'Heads of Support, CX Leaders, and Founders at B2B SaaS companies (Series A–C, 20–500 employees) who are scaling support and drowning in tickets. Headcount is growing faster than revenue.',
    value_prop: 'Deflect 60% of tickets instantly. Regent handles refunds, order tracking, and account management — with multi-lingual triage, Zendesk & Intercom integration, and SLA monitoring. Zero wait time, 24/7.',
    proof_points: [
      '60% cost savings',
      '0s wait time',
      '24/7 availability',
      '99.9% uptime',
      'Efficiency Score: 98.4%',
    ],
    entropy_problem: 'As organizations grow, operational complexity doesn\'t just increase linearly — it compounds. The "Economies of Scale" lie is exposed when your headcount grows faster than your revenue. Manual review adds hours or days to processes that should take milliseconds. SOPs rot in wikis. Training is diluted with every new hire.',
    differentiator: 'Regent doesn\'t just chat. It acts. Capable of handling complex workflows across your entire stack. Connects to your tools (Zendesk, Salesforce, Linear) and starts working alongside your team.',
    tone: 'Confident, direct, zero fluff. Chess metaphors welcome but don\'t force them. Write like a sharp founder talking to another founder. No corporate jargon. No "I hope this finds you well." Every word earns its place.',
    cta: 'A single, low-friction ask — e.g., "Worth a 15-min look?" or "Can I show you how it works in 2 mins?"',
    objection_preempt: 'If the lead has an existing support team, acknowledge it: "Not here to replace your team — here to let them focus on the conversations that actually matter while Regent handles the rest."',
    sample_subject_lines: [
      '{{first_name}}, your support queue is compounding',
      'What if 60% of tickets just... handled themselves?',
      'Quick question about {{company}} support ops',
      '{{company}}\'s headcount vs. revenue',
    ],
    rules: [
      'NEVER mention AI, chatbot, or automation in the first line.',
      'Lead with the PAIN (entropy problem), not the product.',
      'Max 75 words in the email body. No exceptions.',
      'One CTA only. No double asks.',
      'Subject line must be under 7 words and feel human.',
      'Reference the "Economies of Scale" lie or compounding ops complexity if it fits naturally.',
      'NEVER use: leverage, synergy, cutting-edge, revolutionary, game-changer.',
    ],
  },
  {
    campaign_id: 'regent_sales_ops',
    campaign_name: 'Regent — AI Sales Ops',
    client: 'Regent',
    product: 'Sales Ops Agent (Bishop)',
    // ── FROM THE LANDING PAGE ──
    headline: 'Grandmaster your Ops.',
    tagline: 'Every company plays a game. Most play without a system. Regent deploys autonomous AI agents to checkmate your operational inefficiency.',
    positioning: 'Humans for strategy. AI for execution.',
    how_it_works: '1) Ingest & Learn — Builds a dynamic knowledge graph of your company. 2) Autonomous Run — Executes tasks with 99.9% uptime and zero latency. 3) Human Oversight — Edge cases are routed to supervisors for review.',
    // ── SOLUTION-SPECIFIC ──
    target_persona: 'VP Sales, Revenue Leaders, and Founders at B2B startups (Seed–Series B) who are doing outbound manually, have messy CRMs, and can\'t afford a full SDR team yet.',
    value_prop: 'Automate the SDR grind. Lead enrichment, qualification, and meeting prep happened before you wake up. CRM hygiene, outbound personalization, and meeting scheduling — on autopilot. +42% pipeline.',
    proof_points: [
      '+42% pipeline increase',
      '60% cost savings',
      '0s wait time',
      '24/7 availability',
      '99.9% uptime',
    ],
    entropy_problem: 'As organizations grow, operational complexity doesn\'t just increase linearly — it compounds. The "Economies of Scale" lie is exposed when your headcount grows faster than your revenue. Manual review adds hours or days to processes that should take milliseconds.',
    differentiator: 'Regent doesn\'t just chat. It acts. Connects to your tools (Salesforce, Linear) and starts working alongside your team. Ingest & Learn builds a dynamic knowledge graph of your company.',
    tone: 'Peer-to-peer, slightly irreverent. Like a smart friend who happens to know sales. Conversational, not salesy. Short punchy sentences. Chess metaphors are on-brand.',
    cta: 'A specific, time-boxed ask — e.g., "15 mins this week?" or "Want me to show you how it preps a meeting in 30 seconds?"',
    objection_preempt: 'If the lead already has SDRs, position as augmentation: "Not replacing your reps — giving them superpowers. They close, Regent preps."',
    sample_subject_lines: [
      '{{first_name}}, doing your own outbound?',
      'Your pipeline grew 42%. You didn\'t hire anyone.',
      'What if meeting prep happened while you slept?',
      '{{company}}\'s CRM needs therapy',
    ],
    rules: [
      'NEVER open with "I" — always open with the prospect or their company.',
      'Reference something specific about the lead (title, company, industry).',
      'Max 75 words in the email body. No exceptions.',
      'One CTA only. No double asks.',
      'Subject line must be under 7 words and feel human.',
      'Use the +42% pipeline stat only if it fits naturally — don\'t force it.',
      'NEVER use: leverage, synergy, cutting-edge, revolutionary, game-changer.',
    ],
  },
  {
    campaign_id: 'regent_back_office',
    campaign_name: 'Regent — AI Back Office',
    client: 'Regent',
    product: 'Back Office Agent',
    // ── FROM THE LANDING PAGE ──
    headline: 'Grandmaster your Ops.',
    tagline: 'Every company plays a game. Most play without a system. Regent deploys autonomous AI agents to checkmate your operational inefficiency.',
    positioning: 'Humans for strategy. AI for execution.',
    how_it_works: '1) Ingest & Learn — Builds a dynamic knowledge graph of your company. 2) Autonomous Run — Executes tasks with 99.9% uptime and zero latency. 3) Human Oversight — Edge cases are routed to supervisors for review.',
    // ── SOLUTION-SPECIFIC ──
    target_persona: 'COOs, Heads of Finance, and Operations Leaders at mid-market companies (50–500 employees) buried in manual back-office work — invoice processing, compliance checks, vendor onboarding.',
    value_prop: 'The invisible work, handled. Invoice processing, KYC checks, and vendor onboarding — all automated. Invoice extraction, compliance checks, and data entry that runs while your team focuses on strategy.',
    proof_points: [
      '60% cost savings',
      '0s wait time',
      '24/7 availability',
      '100% security',
      '99.9% uptime',
    ],
    entropy_problem: 'As organizations grow, operational complexity doesn\'t just increase linearly — it compounds. SOPs rot in wikis. Training is diluted with every new hire. The "Economies of Scale" lie is exposed when your headcount grows faster than your revenue.',
    differentiator: 'Regent doesn\'t just chat. It acts. Capable of handling complex workflows across your entire stack. Human oversight built in — edge cases are routed to supervisors for review.',
    tone: 'Professional but not boring. Empathetic to the pain of back-office work. Slightly conspiratorial — like "we both know this work shouldn\'t take this long." Direct and efficient, matching the persona.',
    cta: 'Low-friction — e.g., "Worth a quick look?" or "Can I show you what this looks like for {{company}}?"',
    objection_preempt: 'If the lead has an existing ops team or BPO provider, position as upgrade: "Your current process works. This makes it invisible."',
    sample_subject_lines: [
      '{{first_name}}, the invisible work',
      'How many hours did invoices cost {{company}} this month?',
      'Your back office called — it wants to automate',
      'KYC checks at 3am? Regent doesn\'t sleep.',
    ],
    rules: [
      'NEVER mention AI or automation in the first line.',
      'Lead with the invisible pain of back-office work.',
      'Max 75 words in the email body. No exceptions.',
      'One CTA only. No double asks.',
      'Subject line must be under 7 words and feel human.',
      'Reference specific back-office tasks (invoices, KYC, vendor onboarding) — not generic "operations."',
      'NEVER use: leverage, synergy, cutting-edge, revolutionary, game-changer.',
    ],
  },
];

// ── THE LOOKUP ──────────────────────────────
const lead = $input.first().json;

const campaignId = lead.campaign_id || '';
const campaign = CAMPAIGNS.find((c) => c.campaign_id === campaignId);

if (!campaign) {
  return [{
    json: {
      error: true,
      reason: `No campaign found for campaign_id: "${campaignId}"`,
      lead_id: lead.id,
    },
  }];
}

// ── BUILD THE HANDOFF PAYLOAD ───────────────
// Everything Claude needs to draft the email.
return [{
  json: {
    error: false,
    // Lead data
    lead_id: lead.id,
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    company: lead.company || '',
    title: lead.title || '',
    industry: lead.industry || '',
    linkedin_url: lead.linkedin_url || '',
    notes: lead.notes || '',
    // Campaign config (injected into Claude's prompt)
    campaign_id: campaign.campaign_id,
    campaign_name: campaign.campaign_name,
    client: campaign.client,
    product: campaign.product,
    headline: campaign.headline,
    tagline: campaign.tagline,
    positioning: campaign.positioning,
    how_it_works: campaign.how_it_works,
    target_persona: campaign.target_persona,
    value_prop: campaign.value_prop,
    proof_points: campaign.proof_points,
    entropy_problem: campaign.entropy_problem,
    differentiator: campaign.differentiator,
    tone: campaign.tone,
    cta: campaign.cta,
    objection_preempt: campaign.objection_preempt,
    sample_subject_lines: campaign.sample_subject_lines,
    rules: campaign.rules,
  },
}];
