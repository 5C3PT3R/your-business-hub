/**
 * Knight — Full RAG & Scoring Workflow
 *
 * Architecture:
 *   1. KnowledgeBase     — BM25-style retrieval, returns top-K relevant chunks
 *   2. KnightValidator   — points-based grounding + hallucination check
 *   3. processSupportFlow — orchestrates retrieve → generate → validate → route
 *
 * Scoring (threshold 75):
 *   +50  Direct Grounding   — every noun/instruction in answer exists in context
 *   +30  Semantic Alignment — query token coverage against retrieved corpus
 *  -200  Zero-Guessing      — URL / feature / how-to step absent from context
 *
 * NOTE: max attainable score = 80 (50+30), so threshold is 75 not 85.
 * Using 85 would mean nothing ever passes (spec error in original brief).
 *
 * Routing:
 *   score >= 75  → T1_COMPLETE   (answer delivered to user)
 *   score <  75  → T2_ESCALATE   (HumanEscalation handed to agent queue)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATA STRUCTURES
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportTicket {
  userQuery: string;
  retrievedContext: string[];
  metadata: {
    ticketId: string;
    timestamp: string;
    userId?: string;
    channel?: 'whatsapp' | 'email' | 'chat' | 'instagram';
    tier?: 'T1' | 'T2';
  };
}

export interface ValidationBreakdown {
  /** +50 if every extracted noun/instruction in the answer is grounded in context. */
  direct_grounding: number;
  /** 0–30 proportional to query↔context token overlap. */
  semantic_alignment: number;
  /** -200 if any URL, feature name, or how-to step is absent from context. */
  zero_guessing_penalty: number;
  total: number;
}

export interface KnightAnswer {
  action: 'T1_COMPLETE';
  answer: string;
  score: number;
  breakdown: ValidationBreakdown;
  ticket: SupportTicket;
}

export type EscalationReason =
  | 'Hallucination detected'
  | 'Context mismatch'
  | 'Low confidence'
  | 'No relevant context';

export interface HumanEscalation {
  action: 'T2_ESCALATE';
  score: number;
  breakdown: ValidationBreakdown;
  originalQuery: string;
  failureReason: EscalationReason;
  /** Pre-formatted summary sent to the human agent queue. */
  agentDraftSummary: string;
  /** Offending tokens that triggered hallucination (if applicable). */
  hallucinationOffenders?: string[];
  ticket: SupportTicket;
}

export type FlowResult = KnightAnswer | HumanEscalation;

// ─────────────────────────────────────────────────────────────────────────────
// 2. KNOWLEDGE BASE
//    BM25-inspired retrieval — no external deps, runs in Deno/Node/browser.
//    In production: swap fetch() against Supabase pgvector or Pinecone.
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeChunk {
  id: string;
  topic: string;
  content: string;
  /** Keyword tags used to boost retrieval for exact T1 intents. */
  tags: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/** Inverse document frequency proxy — penalises tokens present in every chunk. */
function idf(token: string, chunks: KnowledgeChunk[]): number {
  const df = chunks.filter(c => c.content.toLowerCase().includes(token)).length;
  return df === 0 ? 0 : Math.log((chunks.length + 1) / (df + 1));
}

export class KnowledgeBase {
  private chunks: KnowledgeChunk[];

  constructor(chunks: KnowledgeChunk[]) {
    this.chunks = chunks;
  }

  /**
   * Retrieve the top-K most relevant chunks for a query.
   * Scoring = Σ(tf × idf) per query token, with tag-match boost (+2 per tag hit).
   */
  search(query: string, topK = 3): KnowledgeChunk[] {
    const queryTokens = tokenize(query);

    const scored = this.chunks.map(chunk => {
      const contentTokens = tokenize(chunk.content);
      const freq: Record<string, number> = {};
      contentTokens.forEach(t => { freq[t] = (freq[t] ?? 0) + 1; });

      // TF-IDF score
      let score = queryTokens.reduce((sum, token) => {
        const tf = (freq[token] ?? 0) / contentTokens.length;
        return sum + tf * idf(token, this.chunks);
      }, 0);

      // Tag boost — rewards chunks whose tags directly match the intent
      const tagBoost = chunk.tags.filter(tag =>
        queryTokens.some(t => tag.toLowerCase().includes(t))
      ).length * 2;

      return { chunk, score: score + tagBoost };
    });

    // Minimum relevance threshold.
    // 0.01 is too permissive — stop-words like "can"/"get" produce ~0.013 via TF-IDF
    // against any long doc. 0.05 ensures at least one *meaningful* token (or tag hit)
    // matches before we consider a chunk relevant.
    const MIN_SCORE = 0.05;
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(s => s.score >= MIN_SCORE)
      .map(s => s.chunk);
  }

  add(chunk: KnowledgeChunk): void {
    this.chunks.push(chunk);
  }

  size(): number {
    return this.chunks.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LLM ADAPTER INTERFACE
//    Swap in any provider — OpenAI, Anthropic, local Ollama, etc.
//    The mock adapter is used in tests; the real adapter is injected in prod.
// ─────────────────────────────────────────────────────────────────────────────

export interface LLMAdapter {
  generate(userQuery: string, contextChunks: string[]): Promise<string>;
}

/**
 * MockLLMAdapter — for tests only.
 * Returns a response that is either:
 *   (a) grounded:    a faithful paraphrase of the provided context
 *   (b) fabricated:  a response that ignores context (triggers hallucination)
 */
export class MockLLMAdapter implements LLMAdapter {
  constructor(private mode: 'grounded' | 'fabricated' = 'grounded') {}

  async generate(userQuery: string, contextChunks: string[]): Promise<string> {
    if (this.mode === 'grounded') {
      // Return the first 3 sentences from the top context chunk — guaranteed grounded
      const top = contextChunks[0] ?? '';
      const sentences = top.match(/[^.!?]+[.!?]+/g) ?? [top];
      return sentences.slice(0, 3).join(' ').trim();
    }

    // Fabricated: answer a refund question with no refund context
    return (
      'You can request a refund via our Refund Portal at https://refunds.acmeapp.io/portal. ' +
      'Use promo code REFUND2025 when submitting your RMA form. ' +
      'Refunds are typically processed within 5–7 business days.'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. KNIGHT VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her',
  'was', 'one', 'our', 'out', 'his', 'into', 'its', 'may', 'now', 'two', 'how',
  'did', 'get', 'has', 'him', 'let', 'put', 'say', 'she', 'too', 'use',
]);

function extractNouns(text: string): string[] {
  const tokens = new Set<string>();
  // Quoted strings
  (text.match(/"([^"]+)"/g) ?? []).forEach(q => tokens.add(q.replace(/"/g, '').toLowerCase()));
  // Backtick code spans
  (text.match(/`([^`]+)`/g) ?? []).forEach(b => tokens.add(b.replace(/`/g, '').toLowerCase()));
  // URLs
  (text.match(/https?:\/\/[^\s"')>]+/g) ?? []).forEach(u => tokens.add(u));
  // How-to steps: "Click X", "Go to X", "Navigate to X", "Select X"
  (text.match(/(?:click|go to|navigate to|open|select|visit|enter|submit)\s+["']?([A-Za-z0-9 _/-]{2,40})["']?/gi) ?? [])
    .forEach(m => tokens.add(m.toLowerCase()));
  // CamelCase product names
  (text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? []).forEach(c => tokens.add(c.toLowerCase()));
  // Title-case proper nouns (4+ chars, not stop words)
  (text.match(/\b[A-Z][a-z]{3,}\b/g) ?? [])
    .filter(w => !STOP_WORDS.has(w.toLowerCase()))
    .forEach(w => tokens.add(w.toLowerCase()));

  return Array.from(tokens);
}

/**
 * Query-coverage similarity: what fraction of the query's meaningful tokens
 * appear anywhere in the corpus? This is one-sided by design — we measure
 * how well the context *covers the query intent*, not symmetric overlap.
 * Short queries (3–5 tokens) score fairly against long documents.
 */
function queryCoverage(query: string, corpus: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const normCorpus = corpus.toLowerCase();
  const matched = queryTokens.filter(t => normCorpus.includes(t)).length;
  return matched / queryTokens.length;   // 0.0 – 1.0
}

export class KnightValidator {
  private readonly THRESHOLD = 75;

  validate(ticket: SupportTicket, generatedAnswer: string): {
    breakdown: ValidationBreakdown;
    hallucinationOffenders: string[];
    escalationReason: EscalationReason | null;
  } {
    const corpus = ticket.retrievedContext.join('\n');

    // ── Direct Grounding (+50) ────────────────────────────────────────────────
    // Every extracted noun/instruction in the answer must exist in the corpus.
    const nouns = extractNouns(generatedAnswer);
    const allGrounded = nouns.length === 0 ||
      nouns.every(noun => corpus.toLowerCase().includes(noun));
    const direct_grounding = allGrounded ? 50 : 0;

    // ── Semantic Alignment (+0–30) ────────────────────────────────────────────
    // Query-coverage: fraction of query tokens present in the corpus.
    // Coverage >= 0.6 → full 30 pts. Linear below that.
    const coverage = queryCoverage(ticket.userQuery, corpus);
    const semantic_alignment = Math.round(Math.min(coverage / 0.6, 1) * 30);

    // ── Zero-Guessing Penalty (-200) ──────────────────────────────────────────
    // URLs, feature names, how-to steps absent from corpus = hard fail.
    const hallucinationOffenders: string[] = [];
    const urls = generatedAnswer.match(/https?:\/\/[^\s"')>]+/g) ?? [];
    for (const url of urls) {
      if (!corpus.includes(url)) hallucinationOffenders.push(`URL: ${url}`);
    }
    const nounsMissing = nouns.filter(n => !corpus.toLowerCase().includes(n));
    nounsMissing.forEach(n => hallucinationOffenders.push(`Token: ${n}`));

    const zero_guessing_penalty = hallucinationOffenders.length > 0 ? -200 : 0;
    const total = direct_grounding + semantic_alignment + zero_guessing_penalty;

    // ── Escalation reason ─────────────────────────────────────────────────────
    let escalationReason: EscalationReason | null = null;
    if (total < this.THRESHOLD) {
      if (zero_guessing_penalty === -200) {
        escalationReason = 'Hallucination detected';
      } else if (semantic_alignment < 10) {
        escalationReason = 'Context mismatch';
      } else if (direct_grounding === 0) {
        escalationReason = 'Low confidence';
      } else {
        escalationReason = 'Low confidence';
      }
    }

    return {
      breakdown: { direct_grounding, semantic_alignment, zero_guessing_penalty, total },
      hallucinationOffenders,
      escalationReason,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PROCESS SUPPORT FLOW
//    Retrieve → Generate → Validate → Route
// ─────────────────────────────────────────────────────────────────────────────

let _ticketCounter = 1000;

function generateTicketId(): string {
  return `KNT-${++_ticketCounter}`;
}

function buildAgentSummary(
  query: string,
  context: KnowledgeChunk[],
  reason: EscalationReason,
  score: number,
): string {
  const topicList = context.map(c => c.topic).join(', ') || 'none';
  return [
    `ESCALATION SUMMARY`,
    `─────────────────────────────────────`,
    `User Query   : "${query}"`,
    `Failure      : ${reason}`,
    `Confidence   : ${score}/75 (below threshold)`,
    `KB Topics Hit: ${topicList || 'No matching topics'}`,
    ``,
    `ACTION REQUIRED: Human agent should review the query above.`,
    `Suggested steps:`,
    `  1. Verify whether documentation covers this topic.`,
    `  2. If yes, add a new KB chunk to prevent future escalation.`,
    `  3. If no, resolve manually and log resolution for training.`,
  ].join('\n');
}

/**
 * Full orchestration: Retrieve → Generate → Validate → Route.
 *
 * @param userQuery   Raw customer message
 * @param kb          KnowledgeBase instance loaded with your docs
 * @param llm         LLM adapter (real or mock)
 * @param userId      Optional for ticket metadata
 * @param channel     Optional for ticket metadata
 */
export async function processSupportFlow(
  userQuery: string,
  kb: KnowledgeBase,
  llm: LLMAdapter,
  userId?: string,
  channel?: SupportTicket['metadata']['channel'],
): Promise<FlowResult> {
  const ticketId = generateTicketId();
  const timestamp = new Date().toISOString();

  // ── Step 1: Retrieve ──────────────────────────────────────────────────────
  const topChunks = kb.search(userQuery, 3);

  const ticket: SupportTicket = {
    userQuery,
    retrievedContext: topChunks.map(c => c.content),
    metadata: { ticketId, timestamp, userId, channel, tier: 'T1' },
  };

  // ── Step 2: Generate ──────────────────────────────────────────────────────
  // If no relevant context retrieved at all → escalate before calling LLM
  if (topChunks.length === 0) {
    const breakdown: ValidationBreakdown = {
      direct_grounding: 0,
      semantic_alignment: 0,
      zero_guessing_penalty: 0,
      total: 0,
    };
    return {
      action: 'T2_ESCALATE',
      score: 0,
      breakdown,
      originalQuery: userQuery,
      failureReason: 'No relevant context',
      agentDraftSummary: buildAgentSummary(userQuery, [], 'No relevant context', 0),
      ticket: { ...ticket, metadata: { ...ticket.metadata, tier: 'T2' } },
    };
  }

  const generatedAnswer = await llm.generate(userQuery, ticket.retrievedContext);

  // ── Step 3: Validate ──────────────────────────────────────────────────────
  const validator = new KnightValidator();
  const { breakdown, hallucinationOffenders, escalationReason } =
    validator.validate(ticket, generatedAnswer);

  // ── Step 4: Route ─────────────────────────────────────────────────────────
  if (breakdown.total >= 75) {
    return {
      action: 'T1_COMPLETE',
      answer: generatedAnswer,
      score: breakdown.total,
      breakdown,
      ticket,
    };
  }

  return {
    action: 'T2_ESCALATE',
    score: breakdown.total,
    breakdown,
    originalQuery: userQuery,
    failureReason: escalationReason!,
    agentDraftSummary: buildAgentSummary(userQuery, topChunks, escalationReason!, breakdown.total),
    hallucinationOffenders: hallucinationOffenders.length > 0 ? hallucinationOffenders : undefined,
    ticket: { ...ticket, metadata: { ...ticket.metadata, tier: 'T2' } },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DEMO KNOWLEDGE BASE
//    Seed data for tests — password reset, invoice, 2FA.
//    In production: load from Supabase `knowledge_chunks` table.
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_KB_CHUNKS: KnowledgeChunk[] = [
  {
    id: 'kb-001',
    topic: 'Password Reset',
    tags: ['password', 'reset', 'forgot', 'login'],
    content: `
      Password Reset: To reset your password, go to the login page and click "Forgot Password".
      Enter your registered email address. You will receive a password reset link valid for 30 minutes.
      Click the link and choose a new password. Passwords must be at least 8 characters and include
      one uppercase letter and one number. If the link expires, request a new one from the login page.
    `.trim(),
  },
  {
    id: 'kb-002',
    topic: 'Invoice Access',
    tags: ['invoice', 'billing', 'receipt', 'download'],
    content: `
      Invoices: All invoices are available in the Billing section of your account dashboard.
      Navigate to Settings → Billing → Invoices. You can download a PDF copy of any invoice
      from the last 24 months. For invoices older than 24 months, contact support@hireregent.com.
    `.trim(),
  },
  {
    id: 'kb-003',
    topic: '2FA Setup',
    tags: ['2fa', 'two-factor', 'authenticator', 'security', 'otp'],
    content: `
      Two-Factor Authentication (2FA): Enable 2FA in Settings → Security → Two-Factor Authentication.
      Scan the QR code with an authenticator app (Google Authenticator or Authy). Enter the 6-digit
      OTP code to confirm. Save your backup codes in a secure location — they cannot be regenerated.
    `.trim(),
  },
  {
    id: 'kb-004',
    topic: 'Account Lockout',
    tags: ['locked', 'account', 'access', 'blocked', 'suspended'],
    content: `
      Account Locked: Your account is locked after 5 consecutive failed login attempts.
      Wait 15 minutes and try again, or click "Forgot Password" to reset credentials immediately.
      If your account was suspended due to a policy violation, contact support@hireregent.com
      with your account email and a description of the issue.
    `.trim(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7. TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  const kb = new KnowledgeBase(DEMO_KB_CHUNKS);
  const groundedLLM = new MockLLMAdapter('grounded');
  const fabricatedLLM = new MockLLMAdapter('fabricated');

  console.log('Knight Engine — Full RAG & Scoring Workflow');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tests: Array<{
    name: string;
    query: string;
    llm: LLMAdapter;
    expectedAction: 'T1_COMPLETE' | 'T2_ESCALATE';
    expectedReason?: EscalationReason;
  }> = [
    {
      name: 'Test 1 — Password reset, grounded LLM → T1_COMPLETE',
      query: 'How do I reset my password?',
      llm: groundedLLM,
      expectedAction: 'T1_COMPLETE',
    },
    {
      name: 'Test 2 — Invoice request, grounded LLM → T1_COMPLETE',
      query: 'Where can I download my invoice?',
      llm: groundedLLM,
      expectedAction: 'T1_COMPLETE',
    },
    {
      name: '⚠  Test 3 — HALLUCINATION: Password-reset KB + Refund query + Fabricated LLM → T2_ESCALATE',
      query: 'How do I get a refund for my subscription?',
      llm: fabricatedLLM,        // LLM ignores context, fabricates refund steps
      expectedAction: 'T2_ESCALATE',
      expectedReason: 'Hallucination detected',
    },
    {
      name: 'Test 4 — 2FA query, grounded LLM → T1_COMPLETE',
      query: 'How do I set up two-factor authentication?',
      llm: groundedLLM,
      expectedAction: 'T1_COMPLETE',
    },
    {
      name: 'Test 5 — Completely unknown query (no KB match) → T2_ESCALATE',
      query: 'Can I get a custom enterprise SLA agreement signed?',
      llm: groundedLLM,
      expectedAction: 'T2_ESCALATE',
      expectedReason: 'No relevant context',
    },
    {
      name: 'Test 6 — Account locked, grounded LLM → T1_COMPLETE',
      query: 'My account is locked after too many failed logins',
      llm: groundedLLM,
      expectedAction: 'T1_COMPLETE',
    },
  ];

  let passed = 0;

  for (const t of tests) {
    const result = await processSupportFlow(t.query, kb, t.llm);
    const actionOk = result.action === t.expectedAction;
    const reasonOk = !t.expectedReason ||
      (result.action === 'T2_ESCALATE' && result.failureReason === t.expectedReason);
    const ok = actionOk && reasonOk;
    if (ok) passed++;

    const status = ok ? 'PASS' : 'FAIL';
    console.log(`${status}  ${t.name}`);
    console.log(`      query        : "${t.query}"`);
    console.log(`      score        : ${result.breakdown.total}  (grounding:${result.breakdown.direct_grounding} align:${result.breakdown.semantic_alignment} penalty:${result.breakdown.zero_guessing_penalty})`);
    console.log(`      action       : ${result.action}`);

    if (result.action === 'T2_ESCALATE') {
      console.log(`      reason       : ${result.failureReason}`);
      if (result.hallucinationOffenders?.length) {
        console.log(`      offenders    : ${result.hallucinationOffenders.slice(0, 3).join(' | ')}`);
      }
      console.log(`\n--- Agent Draft Summary ---`);
      console.log(result.agentDraftSummary);
      console.log(`───────────────────────────`);
    } else {
      console.log(`      answer       : "${result.answer.slice(0, 100)}..."`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${tests.length} passed`);
  console.log('═══════════════════════════════════════════════════════════');
}

// Run when invoked directly
// @ts-ignore
if (typeof process !== 'undefined' && process.argv[1]?.includes('knight-engine')) {
  runTests().catch(console.error);
}
