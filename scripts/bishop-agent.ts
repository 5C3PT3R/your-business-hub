/**
 * BISHOP AGENT - Deal Continuity & Conversion Engine
 *
 * Role: Own the space between "interest" and "decision"
 *
 * Bishop IS responsible for:
 * - Follow-ups (external)
 * - Objection handling
 * - Deal nudges
 * - Contract reminders
 * - Timing intelligence
 * - Escalation preparation
 *
 * Bishop is NOT responsible for:
 * - Initial outreach (Rook)
 * - Final negotiation authority (King)
 * - Pricing decisions
 * - Legal approvals
 *
 * Run: npx tsx scripts/bishop-agent.ts
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================
// CONFIGURATION
// ============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[BISHOP] Missing Supabase credentials');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';

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

if (!currentConfig?.apiKey) {
  console.error(`[BISHOP] Missing API key for ${LLM_PROVIDER}`);
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: currentConfig.baseURL,
  apiKey: currentConfig.apiKey,
});

// ============================================
// TYPES & INTERFACES
// ============================================

// Deal States (from PRD Section 5)
enum DealStage {
  INTERESTED = 'interested',
  CONSIDERING = 'considering',
  OBJECTION_RAISED = 'objection_raised',
  WAITING_ON_CLIENT = 'waiting_on_client',
  CONTRACT_SENT = 'contract_sent',
  STALLED = 'stalled',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
  LOST = 'lost',
}

// Objection Taxonomy (from PRD Section 7)
enum ObjectionType {
  PRICE = 'price',
  TIMING = 'timing',
  TRUST = 'trust',
  AUTHORITY = 'authority',
  FEATURE_GAP = 'feature_gap',
  INTERNAL_BUYIN = 'internal_buyin',
  UNKNOWN = 'unknown',
}

// Action Types
enum ActionType {
  FOLLOW_UP = 'follow_up',
  OBJECTION_RESPONSE = 'objection_response',
  NUDGE = 'nudge',
  CONTRACT_REMINDER = 'contract_reminder',
  ESCALATION = 'escalation',
  STATE_UPDATE = 'state_update',
  RISK_FLAG = 'risk_flag',
}

// Risk Levels
enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Core Data Models (from PRD Section 13)
interface Deal {
  id: string;
  stage: DealStage;
  value: number;
  company: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  last_activity_at: Date;
  created_at: Date;
  risk_level: RiskLevel;
  objection_tags: ObjectionType[];
  follow_up_count: number;
  cool_down_until?: Date;
  icp_profile?: string;
  conversation_history: Interaction[];
  metadata?: Record<string, unknown>;
}

interface Interaction {
  id: string;
  deal_id: string;
  sender: 'bishop' | 'client' | 'king' | 'system';
  content: string;
  sentiment: number; // -1 to 1
  timestamp: Date;
  action_type?: ActionType;
}

interface BishopAction {
  deal_id: string;
  action_type: ActionType;
  content: string;
  confidence_score: number;
  escalated: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface EscalationPayload {
  deal_id: string;
  summary: string[];
  risk_assessment: RiskLevel;
  suggested_response: string;
  recommended_action: string;
  reason: string;
}

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

const CONFIG = {
  // Confidence thresholds
  MIN_CONFIDENCE_EXTERNAL: 70, // Below this, escalate instead of send
  ESCALATION_VALUE_THRESHOLD: 50000, // Deals above this always need review

  // Timing rules (days)
  FOLLOW_UP_DAY_1: 1,
  FOLLOW_UP_DAY_2: 3,
  FOLLOW_UP_DAY_3: 7,
  STALLED_THRESHOLD: 10,

  // Rate limits
  MAX_FOLLOW_UPS_PER_DEAL: 5,
  COOL_DOWN_HOURS: 48, // Minimum hours between follow-ups

  // Sentiment thresholds
  NEGATIVE_SENTIMENT_THRESHOLD: -0.3,

  // Brand tone (from PRD Section 9)
  FORBIDDEN_PHRASES: ['AI', 'artificial intelligence', 'guaranteed', 'promise', 'absolutely'],
  ALLOWED_FRAMINGS: [
    "Here's what usually works",
    "Happy to align on next steps",
    "Let me know how you'd like to proceed",
    "Based on similar situations",
    "Would it help if we",
  ],
};

// ============================================
// AUDIT LOGGER
// ============================================

class AuditLogger {
  private logs: BishopAction[] = [];

  async log(action: BishopAction): Promise<void> {
    this.logs.push(action);
    console.log(`[BISHOP:AUDIT] ${action.action_type} | Deal: ${action.deal_id} | Confidence: ${action.confidence_score}% | Escalated: ${action.escalated}`);

    // Persist to database
    try {
      await supabase.from('bishop_actions').insert({
        deal_id: action.deal_id,
        action_type: action.action_type,
        content: action.content,
        confidence_score: action.confidence_score,
        escalated: action.escalated,
        metadata: action.metadata,
        created_at: action.timestamp.toISOString(),
      });
    } catch (error) {
      console.error('[BISHOP:AUDIT] Failed to persist log:', error);
    }
  }

  getHistory(deal_id: string): BishopAction[] {
    return this.logs.filter(l => l.deal_id === deal_id);
  }
}

const auditLogger = new AuditLogger();

// ============================================
// STATE RESOLVER
// ============================================

class StateResolver {
  /**
   * Determines what action Bishop should take based on deal state
   */
  resolveAction(deal: Deal): { shouldAct: boolean; actionType: ActionType | null; reason: string } {
    const daysSinceActivity = this.getDaysSince(deal.last_activity_at);

    // Check cool-down period
    if (deal.cool_down_until && new Date() < deal.cool_down_until) {
      return { shouldAct: false, actionType: null, reason: 'Deal in cool-down period' };
    }

    // Check follow-up limits
    if (deal.follow_up_count >= CONFIG.MAX_FOLLOW_UPS_PER_DEAL) {
      return { shouldAct: false, actionType: ActionType.ESCALATION, reason: 'Max follow-ups reached, escalating' };
    }

    // State-specific logic
    switch (deal.stage) {
      case DealStage.INTERESTED:
        if (daysSinceActivity >= CONFIG.FOLLOW_UP_DAY_1) {
          return { shouldAct: true, actionType: ActionType.FOLLOW_UP, reason: 'Day 1-2: Light follow-up' };
        }
        break;

      case DealStage.CONSIDERING:
        if (daysSinceActivity >= CONFIG.FOLLOW_UP_DAY_2) {
          return { shouldAct: true, actionType: ActionType.NUDGE, reason: 'Day 3-5: Value-based nudge' };
        }
        break;

      case DealStage.OBJECTION_RAISED:
        return { shouldAct: true, actionType: ActionType.OBJECTION_RESPONSE, reason: 'Objection requires response' };

      case DealStage.WAITING_ON_CLIENT:
        if (daysSinceActivity >= CONFIG.FOLLOW_UP_DAY_3) {
          return { shouldAct: true, actionType: ActionType.FOLLOW_UP, reason: 'Day 7: Explicit next-step ask' };
        }
        break;

      case DealStage.CONTRACT_SENT:
        if (daysSinceActivity >= 3) {
          return { shouldAct: true, actionType: ActionType.CONTRACT_REMINDER, reason: 'Contract follow-up needed' };
        }
        break;

      case DealStage.STALLED:
        if (daysSinceActivity >= CONFIG.STALLED_THRESHOLD) {
          return { shouldAct: true, actionType: ActionType.ESCALATION, reason: 'Day 10+: Escalation recommended' };
        }
        break;

      case DealStage.ESCALATED:
      case DealStage.CLOSED:
      case DealStage.LOST:
        return { shouldAct: false, actionType: null, reason: 'Deal in terminal state' };
    }

    return { shouldAct: false, actionType: null, reason: 'No action needed at this time' };
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

// ============================================
// OBJECTION CLASSIFIER
// ============================================

class ObjectionClassifier {
  private patterns: Record<ObjectionType, RegExp[]> = {
    [ObjectionType.PRICE]: [
      /too expensive/i, /cost/i, /budget/i, /afford/i, /pricing/i, /cheaper/i, /discount/i
    ],
    [ObjectionType.TIMING]: [
      /not (the )?right time/i, /later/i, /next (quarter|year|month)/i, /busy/i, /priorities/i
    ],
    [ObjectionType.TRUST]: [
      /not sure/i, /concerns?/i, /skeptical/i, /prove/i, /case study/i, /references?/i
    ],
    [ObjectionType.AUTHORITY]: [
      /need to (talk|check|ask)/i, /my (boss|manager|team)/i, /decision maker/i, /approve/i
    ],
    [ObjectionType.FEATURE_GAP]: [
      /doesn't have/i, /missing/i, /need .+ feature/i, /can it do/i, /integrate/i
    ],
    [ObjectionType.INTERNAL_BUYIN]: [
      /get (the )?team/i, /convince/i, /stakeholder/i, /alignment/i, /buy-in/i
    ],
    [ObjectionType.UNKNOWN]: [],
  };

  classify(content: string): { type: ObjectionType; confidence: number } {
    for (const [type, patterns] of Object.entries(this.patterns)) {
      if (type === ObjectionType.UNKNOWN) continue;

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return { type: type as ObjectionType, confidence: 80 };
        }
      }
    }

    return { type: ObjectionType.UNKNOWN, confidence: 30 };
  }
}

// ============================================
// CONFIDENCE SCORER
// ============================================

class ConfidenceScorer {
  /**
   * Calculates confidence score for an action
   * If below threshold, Bishop should escalate instead of act
   */
  calculate(deal: Deal, actionType: ActionType, objectionType?: ObjectionType): number {
    let score = 50; // Base score

    // Deal value factor (high-value deals = lower confidence = more likely to escalate)
    if (deal.value > CONFIG.ESCALATION_VALUE_THRESHOLD) {
      score -= 20;
    } else if (deal.value > CONFIG.ESCALATION_VALUE_THRESHOLD / 2) {
      score -= 10;
    }

    // Conversation history factor
    const recentInteractions = deal.conversation_history.filter(
      i => this.isRecent(i.timestamp, 7)
    );
    if (recentInteractions.length > 0) {
      score += 10;
    }

    // Sentiment factor
    const avgSentiment = this.getAverageSentiment(deal.conversation_history);
    if (avgSentiment < CONFIG.NEGATIVE_SENTIMENT_THRESHOLD) {
      score -= 15;
    } else if (avgSentiment > 0.3) {
      score += 10;
    }

    // Action type factor
    switch (actionType) {
      case ActionType.FOLLOW_UP:
        score += 15; // Safe action
        break;
      case ActionType.OBJECTION_RESPONSE:
        // Depends on objection type
        if (objectionType === ObjectionType.PRICE || objectionType === ObjectionType.AUTHORITY) {
          score -= 10; // These need human touch
        }
        break;
      case ActionType.CONTRACT_REMINDER:
        score += 5;
        break;
      case ActionType.NUDGE:
        score += 10;
        break;
    }

    // Follow-up count factor (more follow-ups = lower confidence)
    score -= deal.follow_up_count * 5;

    // C-level contact factor
    const cLevelRoles = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'president', 'vp'];
    if (cLevelRoles.some(role => deal.contact_role.toLowerCase().includes(role))) {
      score -= 10; // More careful with executives
    }

    return Math.max(0, Math.min(100, score));
  }

  private isRecent(date: Date, days: number): boolean {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return diff < days * 24 * 60 * 60 * 1000;
  }

  private getAverageSentiment(interactions: Interaction[]): number {
    if (interactions.length === 0) return 0;
    const sum = interactions.reduce((acc, i) => acc + i.sentiment, 0);
    return sum / interactions.length;
  }
}

// ============================================
// ESCALATION BUILDER
// ============================================

class EscalationBuilder {
  /**
   * Builds a clean escalation payload for King
   * King never sees raw chaos - only prepared decisions
   */
  build(deal: Deal, reason: string, suggestedAction: ActionType): EscalationPayload {
    const summary = this.generateSummary(deal);
    const riskAssessment = this.assessRisk(deal);
    const suggestedResponse = this.suggestResponse(deal, suggestedAction);
    const recommendedAction = this.recommendAction(deal, suggestedAction);

    return {
      deal_id: deal.id,
      summary,
      risk_assessment: riskAssessment,
      suggested_response: suggestedResponse,
      recommended_action: recommendedAction,
      reason,
    };
  }

  private generateSummary(deal: Deal): string[] {
    const daysSinceActivity = Math.floor(
      (new Date().getTime() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    return [
      `${deal.company} - ${deal.contact_name} (${deal.contact_role})`,
      `Deal value: $${deal.value.toLocaleString()} | Stage: ${deal.stage}`,
      `Last activity: ${daysSinceActivity} days ago | Follow-ups sent: ${deal.follow_up_count}`,
    ];
  }

  private assessRisk(deal: Deal): RiskLevel {
    const daysSinceActivity = Math.floor(
      (new Date().getTime() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (deal.stage === DealStage.STALLED || daysSinceActivity > 14) {
      return RiskLevel.CRITICAL;
    }
    if (deal.objection_tags.includes(ObjectionType.PRICE) || daysSinceActivity > 7) {
      return RiskLevel.HIGH;
    }
    if (deal.follow_up_count >= 3) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private suggestResponse(deal: Deal, actionType: ActionType): string {
    switch (actionType) {
      case ActionType.OBJECTION_RESPONSE:
        return `Address ${deal.objection_tags.join(', ')} concerns with case study or direct call`;
      case ActionType.ESCALATION:
        return 'Recommend founder/executive call to re-engage';
      case ActionType.CONTRACT_REMINDER:
        return 'Personal follow-up on contract status with timeline clarity';
      default:
        return 'Direct outreach to understand current status and blockers';
    }
  }

  private recommendAction(deal: Deal, suggestedAction: ActionType): string {
    if (deal.value > CONFIG.ESCALATION_VALUE_THRESHOLD) {
      return 'CALL: High-value deal requires personal touch';
    }
    if (deal.stage === DealStage.STALLED) {
      return 'REACTIVATE: Consider new angle or incentive';
    }
    if (deal.objection_tags.length > 0) {
      return 'ADDRESS: Resolve objections before proceeding';
    }
    return 'FOLLOW_UP: Standard nurture sequence';
  }
}

// ============================================
// RESPONSE GENERATOR
// ============================================

class ResponseGenerator {
  private objectionFrameworks: Record<ObjectionType, string> = {
    [ObjectionType.PRICE]: `Focus on ROI and value, not discounting. Offer payment flexibility if available. Ask what budget range would work.`,
    [ObjectionType.TIMING]: `Acknowledge their timeline. Offer to stay in touch. Ask what would need to change for timing to work.`,
    [ObjectionType.TRUST]: `Offer case studies, references, or pilot program. Acknowledge it's a significant decision.`,
    [ObjectionType.AUTHORITY]: `Offer to include decision maker in next call. Provide materials they can share internally.`,
    [ObjectionType.FEATURE_GAP]: `Be honest about current capabilities. Share roadmap if relevant. Explore workarounds.`,
    [ObjectionType.INTERNAL_BUYIN]: `Offer stakeholder presentation or materials. Ask who else should be involved.`,
    [ObjectionType.UNKNOWN]: `Ask clarifying questions to understand the real concern.`,
  };

  async generate(
    deal: Deal,
    actionType: ActionType,
    objectionType?: ObjectionType
  ): Promise<{ subject: string; body: string; confidence: number }> {
    const prompt = this.buildPrompt(deal, actionType, objectionType);

    try {
      const response = await openai.chat.completions.create({
        model: currentConfig.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty LLM response');

      const parsed = this.parseResponse(content);
      const confidence = this.validateTone(parsed.body);

      return { ...parsed, confidence };
    } catch (error) {
      console.error('[BISHOP:GENERATOR] Error:', error);
      return this.getFallback(deal, actionType);
    }
  }

  private getSystemPrompt(): string {
    return `You are BISHOP, a professional follow-up specialist.

CRITICAL RULES:
- Never say "AI" or "artificial intelligence"
- Never make absolute claims or promises
- Never oversell or pressure
- Under 150 words
- Professional, warm, but not sycophantic

ALLOWED FRAMINGS:
${CONFIG.ALLOWED_FRAMINGS.map(f => `- "${f}"`).join('\n')}

OUTPUT FORMAT (JSON only):
{
  "subject": "Subject line",
  "body": "Email body"
}`;
  }

  private buildPrompt(deal: Deal, actionType: ActionType, objectionType?: ObjectionType): string {
    let context = `Contact: ${deal.contact_name} (${deal.contact_role}) at ${deal.company}
Deal Value: $${deal.value.toLocaleString()}
Current Stage: ${deal.stage}
Follow-ups Sent: ${deal.follow_up_count}
`;

    if (deal.conversation_history.length > 0) {
      const lastInteraction = deal.conversation_history[deal.conversation_history.length - 1];
      context += `\nLast interaction: "${lastInteraction.content.substring(0, 200)}..."`;
    }

    switch (actionType) {
      case ActionType.FOLLOW_UP:
        return `${context}\n\nWrite a light follow-up email. Be helpful, not pushy.`;

      case ActionType.NUDGE:
        return `${context}\n\nWrite a value-based nudge. Share something useful, then ask about next steps.`;

      case ActionType.OBJECTION_RESPONSE:
        const framework = this.objectionFrameworks[objectionType || ObjectionType.UNKNOWN];
        return `${context}\n\nObjection type: ${objectionType}\nFramework: ${framework}\n\nWrite a response addressing this objection.`;

      case ActionType.CONTRACT_REMINDER:
        return `${context}\n\nWrite a gentle contract follow-up. Ask if they have questions or need changes.`;

      default:
        return `${context}\n\nWrite an appropriate follow-up email.`;
    }
  }

  private parseResponse(content: string): { subject: string; body: string } {
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      jsonStr = content.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());
    return { subject: parsed.subject, body: parsed.body };
  }

  private validateTone(body: string): number {
    let confidence = 100;

    // Check for forbidden phrases
    for (const phrase of CONFIG.FORBIDDEN_PHRASES) {
      if (body.toLowerCase().includes(phrase.toLowerCase())) {
        confidence -= 20;
      }
    }

    // Check length
    if (body.split(' ').length > 200) {
      confidence -= 10;
    }

    // Check for pushy language
    const pushyPhrases = ['act now', 'limited time', 'don\'t miss', 'urgent'];
    for (const phrase of pushyPhrases) {
      if (body.toLowerCase().includes(phrase)) {
        confidence -= 15;
      }
    }

    return Math.max(0, confidence);
  }

  private getFallback(deal: Deal, actionType: ActionType): { subject: string; body: string; confidence: number } {
    return {
      subject: `Following up - ${deal.company}`,
      body: `Hi ${deal.contact_name},

Hope you're doing well. Wanted to check in and see if you had any questions about our conversation.

Happy to align on next steps whenever works for you.

Best regards`,
      confidence: 60,
    };
  }
}

// ============================================
// BISHOP ENGINE (Main Orchestrator)
// ============================================

class BishopEngine {
  private stateResolver = new StateResolver();
  private objectionClassifier = new ObjectionClassifier();
  private confidenceScorer = new ConfidenceScorer();
  private escalationBuilder = new EscalationBuilder();
  private responseGenerator = new ResponseGenerator();

  /**
   * Process a single deal
   */
  async processDeal(deal: Deal): Promise<{
    action: BishopAction | null;
    escalation: EscalationPayload | null;
    draft: { subject: string; body: string } | null;
  }> {
    console.log(`\n[BISHOP] Processing deal: ${deal.id} (${deal.company})`);
    console.log(`[BISHOP] Current stage: ${deal.stage}`);

    // Step 1: Resolve what action to take
    const resolution = this.stateResolver.resolveAction(deal);
    console.log(`[BISHOP] Resolution: ${resolution.reason}`);

    if (!resolution.shouldAct || !resolution.actionType) {
      return { action: null, escalation: null, draft: null };
    }

    // Step 2: Classify objection if present
    let objectionType: ObjectionType | undefined;
    if (resolution.actionType === ActionType.OBJECTION_RESPONSE && deal.objection_tags.length > 0) {
      objectionType = deal.objection_tags[0];
    } else if (deal.conversation_history.length > 0) {
      const lastMessage = deal.conversation_history[deal.conversation_history.length - 1];
      if (lastMessage.sender === 'client') {
        const classification = this.objectionClassifier.classify(lastMessage.content);
        if (classification.confidence > 60) {
          objectionType = classification.type;
        }
      }
    }

    // Step 3: Calculate confidence
    const confidence = this.confidenceScorer.calculate(deal, resolution.actionType, objectionType);
    console.log(`[BISHOP] Confidence score: ${confidence}%`);

    // Step 4: Check escalation conditions
    const shouldEscalate = this.shouldEscalate(deal, confidence, resolution.actionType);

    if (shouldEscalate) {
      console.log(`[BISHOP] Escalating to King...`);
      const escalation = this.escalationBuilder.build(deal, resolution.reason, resolution.actionType);

      const action: BishopAction = {
        deal_id: deal.id,
        action_type: ActionType.ESCALATION,
        content: JSON.stringify(escalation),
        confidence_score: confidence,
        escalated: true,
        timestamp: new Date(),
        metadata: { reason: resolution.reason, original_action: resolution.actionType },
      };

      await auditLogger.log(action);
      await this.createKingTask(escalation);

      return { action, escalation, draft: null };
    }

    // Step 5: Generate response
    console.log(`[BISHOP] Generating ${resolution.actionType} response...`);
    const response = await this.responseGenerator.generate(deal, resolution.actionType, objectionType);

    // Step 6: Final confidence check after generation
    const finalConfidence = Math.min(confidence, response.confidence);
    console.log(`[BISHOP] Final confidence: ${finalConfidence}%`);

    if (finalConfidence < CONFIG.MIN_CONFIDENCE_EXTERNAL) {
      console.log(`[BISHOP] Confidence too low, escalating instead of sending...`);
      const escalation = this.escalationBuilder.build(deal, 'Low confidence in generated response', resolution.actionType);

      const action: BishopAction = {
        deal_id: deal.id,
        action_type: ActionType.ESCALATION,
        content: JSON.stringify({ ...escalation, draft: response }),
        confidence_score: finalConfidence,
        escalated: true,
        timestamp: new Date(),
      };

      await auditLogger.log(action);
      await this.createKingTask(escalation);

      return { action, escalation, draft: response };
    }

    // Step 7: Create draft for approval
    const action: BishopAction = {
      deal_id: deal.id,
      action_type: resolution.actionType,
      content: response.body,
      confidence_score: finalConfidence,
      escalated: false,
      timestamp: new Date(),
      metadata: { subject: response.subject, objection_type: objectionType },
    };

    await auditLogger.log(action);
    await this.insertDraft(deal, response, finalConfidence);

    return { action, escalation: null, draft: response };
  }

  private shouldEscalate(deal: Deal, confidence: number, actionType: ActionType): boolean {
    // Always escalate high-value deals
    if (deal.value > CONFIG.ESCALATION_VALUE_THRESHOLD) {
      console.log(`[BISHOP] High-value deal ($${deal.value}) - escalating`);
      return true;
    }

    // Escalate if confidence is too low
    if (confidence < CONFIG.MIN_CONFIDENCE_EXTERNAL) {
      console.log(`[BISHOP] Low confidence (${confidence}%) - escalating`);
      return true;
    }

    // Escalate stalled deals
    if (deal.stage === DealStage.STALLED) {
      return true;
    }

    // Escalate after max follow-ups
    if (deal.follow_up_count >= CONFIG.MAX_FOLLOW_UPS_PER_DEAL - 1) {
      return true;
    }

    // Escalate price/authority objections
    if (deal.objection_tags.includes(ObjectionType.PRICE) ||
        deal.objection_tags.includes(ObjectionType.AUTHORITY)) {
      return true;
    }

    return false;
  }

  private async createKingTask(escalation: EscalationPayload): Promise<void> {
    try {
      await supabase.from('king_tasks').insert({
        deal_id: escalation.deal_id,
        type: 'escalation',
        priority: escalation.risk_assessment === RiskLevel.CRITICAL ? 'urgent' : 'normal',
        summary: escalation.summary.join('\n'),
        suggested_response: escalation.suggested_response,
        recommended_action: escalation.recommended_action,
        reason: escalation.reason,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      console.log(`[BISHOP] Created King task for deal ${escalation.deal_id}`);
    } catch (error) {
      console.error('[BISHOP] Failed to create King task:', error);
    }
  }

  private async insertDraft(
    deal: Deal,
    response: { subject: string; body: string },
    confidence: number
  ): Promise<void> {
    try {
      await supabase.from('ai_drafts').insert({
        subject: response.subject,
        body: response.body,
        plain_text: response.body,
        persona_used: 'BISHOP_AGENT',
        is_ai_draft: true,
        status: 'PENDING_APPROVAL',
        metadata: {
          deal_id: deal.id,
          target_email: deal.contact_email,
          lead_name: deal.contact_name,
          company: deal.company,
          role: deal.contact_role,
          confidence,
          stage: deal.stage,
          generated_by: 'bishop-engine-v2',
          llm_provider: LLM_PROVIDER,
          generated_at: new Date().toISOString(),
        },
      });
      console.log(`[BISHOP] Draft created for deal ${deal.id}`);
    } catch (error) {
      console.error('[BISHOP] Failed to insert draft:', error);
    }
  }
}

// ============================================
// DEAL FETCHER (Mock for now, will use real DB)
// ============================================

async function fetchActiveDeals(): Promise<Deal[]> {
  // In production, this fetches from the database
  // For now, return mock data for testing

  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .not('stage', 'in', '(closed,lost)')
      .order('last_activity_at', { ascending: true });

    if (error || !data || data.length === 0) {
      console.log('[BISHOP] No active deals found, using mock data');
      return getMockDeals();
    }

    return data.map(d => ({
      id: d.id,
      stage: d.stage as DealStage,
      value: d.value || 0,
      company: d.company,
      contact_name: d.contact_name || d.title,
      contact_email: d.contact_email || '',
      contact_role: d.contact_role || 'Unknown',
      last_activity_at: new Date(d.updated_at || d.created_at),
      created_at: new Date(d.created_at),
      risk_level: RiskLevel.LOW,
      objection_tags: [],
      follow_up_count: d.follow_up_count || 0,
      conversation_history: [],
    }));
  } catch {
    return getMockDeals();
  }
}

function getMockDeals(): Deal[] {
  return [
    {
      id: 'mock-001',
      stage: DealStage.CONSIDERING,
      value: 25000,
      company: 'TechCorp',
      contact_name: 'Sarah Chen',
      contact_email: 'sarah@techcorp.com',
      contact_role: 'VP of Operations',
      last_activity_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      risk_level: RiskLevel.MEDIUM,
      objection_tags: [],
      follow_up_count: 1,
      conversation_history: [
        {
          id: 'int-001',
          deal_id: 'mock-001',
          sender: 'client',
          content: 'Looks interesting, let me review with my team',
          sentiment: 0.3,
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    {
      id: 'mock-002',
      stage: DealStage.OBJECTION_RAISED,
      value: 75000,
      company: 'Enterprise Inc',
      contact_name: 'Michael Torres',
      contact_email: 'mtorres@enterprise.com',
      contact_role: 'CEO',
      last_activity_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      risk_level: RiskLevel.HIGH,
      objection_tags: [ObjectionType.PRICE],
      follow_up_count: 2,
      conversation_history: [
        {
          id: 'int-002',
          deal_id: 'mock-002',
          sender: 'client',
          content: 'The solution looks great but the pricing is higher than we budgeted for this quarter',
          sentiment: -0.2,
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ],
    },
  ];
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      BISHOP ENGINE v2 - Deal Continuity & Conversion          ║');
  console.log('║                                                                 ║');
  console.log('║   "Bishop is not here to win arguments.                        ║');
  console.log('║    Bishop is here to prevent loss through neglect."            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[BISHOP] Provider: ${LLM_PROVIDER.toUpperCase()} (${currentConfig.model})`);
  console.log(`[BISHOP] Confidence threshold: ${CONFIG.MIN_CONFIDENCE_EXTERNAL}%`);
  console.log(`[BISHOP] Escalation value threshold: $${CONFIG.ESCALATION_VALUE_THRESHOLD.toLocaleString()}`);
  console.log('');

  const engine = new BishopEngine();
  const deals = await fetchActiveDeals();

  console.log(`[BISHOP] Found ${deals.length} active deals to process`);
  console.log('═'.repeat(70));

  let processed = 0;
  let escalated = 0;
  let drafted = 0;
  let skipped = 0;

  for (const deal of deals) {
    const result = await engine.processDeal(deal);

    if (result.escalation) {
      escalated++;
      console.log(`\n[BISHOP] ESCALATED: ${deal.company}`);
      console.log(`  Summary: ${result.escalation.summary[0]}`);
      console.log(`  Risk: ${result.escalation.risk_assessment}`);
      console.log(`  Action: ${result.escalation.recommended_action}`);
    } else if (result.draft) {
      drafted++;
      console.log(`\n[BISHOP] DRAFT CREATED: ${deal.company}`);
      console.log(`  Subject: ${result.draft.subject}`);
      console.log(`  Confidence: ${result.action?.confidence_score}%`);
    } else {
      skipped++;
    }

    processed++;
    console.log('─'.repeat(70));
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      MISSION SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`  Deals processed: ${processed}`);
  console.log(`  Drafts created:  ${drafted}`);
  console.log(`  Escalated:       ${escalated}`);
  console.log(`  No action:       ${skipped}`);
  console.log('');
  console.log('[BISHOP] Review drafts at /command-center');
  console.log('[BISHOP] Review escalations at /king-dashboard');
  console.log('');
}

// Export for use as module
export {
  BishopEngine,
  DealStage,
  ObjectionType,
  ActionType,
  RiskLevel,
  Deal,
  BishopAction,
  EscalationPayload,
  CONFIG,
};

// Run if executed directly
main().catch(console.error);
