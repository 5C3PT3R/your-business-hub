/**
 * BISHOP AGENT - Outbound Sales Intelligence Unit
 *
 * Day 4: The Brain
 *
 * This autonomous agent:
 * 1. Takes a target lead with context (news, role, company)
 * 2. Generates personalized cold emails using LLM (DeepSeek/OpenAI)
 * 3. Inserts drafts into ai_drafts table for human approval
 *
 * Run: npx tsx scripts/bishop-agent.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================
// CONFIGURATION
// ============================================

// Supabase - Use SERVICE_ROLE_KEY to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[BISHOP] Missing Supabase credentials');
  console.error('Required: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// LLM Configuration - Supports OpenAI, DeepSeek, or OpenRouter
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // 'openai' | 'deepseek' | 'openrouter'

const LLM_CONFIG: Record<string, { baseURL: string; apiKey: string | undefined; model: string }> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-chat',
  },
};

const currentConfig = LLM_CONFIG[LLM_PROVIDER];

if (!currentConfig.apiKey) {
  console.error(`[BISHOP] Missing API key for ${LLM_PROVIDER}`);
  console.error(`Required: ${LLM_PROVIDER.toUpperCase()}_API_KEY`);
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: currentConfig.baseURL,
  apiKey: currentConfig.apiKey,
});

console.log(`[BISHOP] Initialized with ${LLM_PROVIDER.toUpperCase()} (${currentConfig.model})`);

// ============================================
// TARGET LEAD (Mock Data for Testing)
// ============================================

interface TargetLead {
  name: string;
  email: string;
  company: string;
  role: string;
  recent_news: string;
}

const TARGET_LEAD: TargetLead = {
  name: 'Jensen Huang',
  email: 'eashan.singh78@gmail.com', // Your test email
  company: 'NVIDIA',
  role: 'CEO',
  recent_news: 'Stock hit all time high due to AI chip demand. NVIDIA reported record quarterly revenue of $26B.',
};

// ============================================
// THE BRAIN - LLM Email Generation
// ============================================

interface GeneratedEmail {
  subject: string;
  body: string;
}

async function generateColdEmail(lead: TargetLead): Promise<GeneratedEmail> {
  console.log(`[BISHOP] Generating email for ${lead.name} at ${lead.company}...`);

  const systemPrompt = `You are BISHOP, an elite BPO Sales Agent for Regent AI Workforce.
Your task is to write compelling cold emails that get responses.

Style Guidelines:
- Professional, concise, 'Wall Street' tone
- Under 150 words for the body
- Lead with relevance (their news/context)
- Clear value proposition
- One specific call-to-action
- No fluff, no generic statements

Output Format:
Return ONLY a JSON object with this exact structure:
{
  "subject": "Your subject line here",
  "body": "Your email body here"
}

Do not include any other text, markdown, or explanation.`;

  const userPrompt = `Write a cold email to:
- Name: ${lead.name}
- Company: ${lead.company}
- Role: ${lead.role}
- Recent News: ${lead.recent_news}

Pitch: Regent AI Workforce - autonomous AI agents that scale business operations 24/7.
We help companies like theirs handle increased demand without proportional headcount growth.

Remember: Return ONLY the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: currentConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    console.log('[BISHOP] Raw LLM response:', content);

    // Parse the JSON response
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      jsonStr = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());

    if (!parsed.subject || !parsed.body) {
      throw new Error('Invalid response structure - missing subject or body');
    }

    console.log(`[BISHOP] Generated email with subject: "${parsed.subject}"`);

    return {
      subject: parsed.subject,
      body: parsed.body,
    };
  } catch (error) {
    console.error('[BISHOP] Error generating email:', error);

    // Fallback email if LLM fails
    return {
      subject: `${lead.company} + Regent AI: Scaling with Intelligence`,
      body: `Hi ${lead.name},

Noticed ${lead.company}'s recent momentum - ${lead.recent_news}

At Regent, we deploy autonomous AI agents that handle operational scaling without proportional headcount growth. For a company experiencing your trajectory, this could mean:

- 24/7 operational capacity
- Consistent quality at scale
- Focus your team on strategic work

Worth a 15-minute call to explore fit?

Best,
Regent AI Team`,
    };
  }
}

// ============================================
// DATABASE WRITE - Insert Draft
// ============================================

async function insertDraft(lead: TargetLead, email: GeneratedEmail): Promise<string | null> {
  console.log('[BISHOP] Inserting draft into ai_drafts table...');

  // Calculate confidence based on lead quality signals
  const confidenceScore = calculateConfidence(lead);

  const draftData = {
    subject: email.subject,
    body: email.body,
    plain_text: email.body.replace(/<[^>]*>/g, ''), // Strip any HTML
    persona_used: 'BISHOP_AGENT',
    is_ai_draft: true,
    status: 'PENDING_APPROVAL',
    metadata: {
      target_email: lead.email,
      lead_name: lead.name,
      company: lead.company,
      role: lead.role,
      recent_news: lead.recent_news,
      confidence: confidenceScore,
      context: `Detected high-value news event: ${lead.recent_news}`,
      generated_by: 'bishop-agent',
      llm_provider: LLM_PROVIDER,
      generated_at: new Date().toISOString(),
    },
  };

  try {
    const { data, error } = await supabase
      .from('ai_drafts')
      .insert(draftData)
      .select('id')
      .single();

    if (error) {
      console.error('[BISHOP] Database insert error:', error);
      return null;
    }

    console.log(`[BISHOP] Draft inserted with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('[BISHOP] Unexpected error inserting draft:', error);
    return null;
  }
}

// ============================================
// CONFIDENCE SCORING
// ============================================

function calculateConfidence(lead: TargetLead): number {
  let score = 50; // Base score

  // News recency/relevance bonus
  if (lead.recent_news && lead.recent_news.length > 20) {
    score += 20;
  }

  // C-level role bonus
  const cLevelRoles = ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO', 'Founder', 'President'];
  if (cLevelRoles.some(role => lead.role.toUpperCase().includes(role))) {
    score += 15;
  }

  // Known enterprise company bonus
  const enterpriseCompanies = ['NVIDIA', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Tesla'];
  if (enterpriseCompanies.some(company => lead.company.toUpperCase().includes(company.toUpperCase()))) {
    score += 10;
  }

  // Has email bonus
  if (lead.email && lead.email.includes('@')) {
    score += 5;
  }

  return Math.min(score, 100); // Cap at 100
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           BISHOP AGENT - Outbound Sales Unit               ║');
  console.log('║                   Day 4: The Brain                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('[BISHOP] Target acquired:');
  console.log(`  Name: ${TARGET_LEAD.name}`);
  console.log(`  Company: ${TARGET_LEAD.company}`);
  console.log(`  Role: ${TARGET_LEAD.role}`);
  console.log(`  Email: ${TARGET_LEAD.email}`);
  console.log(`  News: ${TARGET_LEAD.recent_news}`);
  console.log('');

  // Step 1: Generate email using LLM
  const email = await generateColdEmail(TARGET_LEAD);

  console.log('');
  console.log('[BISHOP] Generated Email:');
  console.log('─'.repeat(60));
  console.log(`Subject: ${email.subject}`);
  console.log('─'.repeat(60));
  console.log(email.body);
  console.log('─'.repeat(60));
  console.log('');

  // Step 2: Insert into database
  const draftId = await insertDraft(TARGET_LEAD, email);

  if (draftId) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    MISSION COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`[BISHOP] Draft ID: ${draftId}`);
    console.log('[BISHOP] Status: PENDING_APPROVAL');
    console.log('[BISHOP] Next: Review in Command Center → /command-center');
    console.log('');
  } else {
    console.error('[BISHOP] Mission failed - could not insert draft');
    process.exit(1);
  }
}

// Run the agent
main().catch(console.error);
