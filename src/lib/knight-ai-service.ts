/**
 * The Knight AI Service
 * Handles AI-powered customer support using Claude 3.5 Sonnet
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface SentimentAnalysis {
  score: number; // 1-10 (1 = Angry, 10 = Happy)
  priority: 'low' | 'medium' | 'critical';
  intent: 'complaint' | 'question' | 'urgent' | 'feedback' | 'general';
  keywords: string[];
  requiresEscalation: boolean;
}

export interface KnightResponse {
  message: string;
  tone: 'empathetic' | 'professional' | 'apologetic' | 'helpful';
  suggestedAction?: 'reply' | 'escalate' | 'voice_call' | 'wait';
  confidence: number;
}

export interface KnowledgeContext {
  content: string;
  category: string;
  title?: string;
  similarity: number;
}

// Knight Persona System Prompts
const KNIGHT_PERSONA_TEXT = `You are The Knight, a Customer Success Agent for Regent.
Your goals:
1. De-escalate anger instantly. (e.g., "I understand why that is frustrating.")
2. Solve the problem using the provided Knowledge Base context.
3. Be concise. No fluff.
4. If you cannot solve it, say: "I am escalating this to a human engineer immediately."

Guidelines:
- Never argue with the customer
- Acknowledge their feelings first
- Provide clear, actionable solutions
- Use a warm but professional tone
- Keep responses under 150 words for text channels`;

const KNIGHT_PERSONA_VOICE = `Role: You are a senior support rep. You are calling a customer who just left a bad review or complaint.
Tone: Calm, apologetic, highly competent.
Instructions:
- Introduce yourself: "Hi, this is the Support Team at Regent. I saw your message and wanted to reach out personally."
- Listen to their complaint.
- Offer a refund or a fix.
- Do not interrupt them while they are venting.`;

/**
 * Analyze the sentiment of a message using Claude
 */
export async function analyzeSentiment(message: string): Promise<SentimentAnalysis> {
  try {
    const { data, error } = await supabase.functions.invoke('knight-analyze', {
      body: {
        action: 'analyze_sentiment',
        message,
      },
    });

    if (error) {
      console.error('[Knight] Sentiment analysis error:', error);
      // Return neutral sentiment on error
      return {
        score: 5,
        priority: 'medium',
        intent: 'general',
        keywords: [],
        requiresEscalation: false,
      };
    }

    return data as SentimentAnalysis;
  } catch (err) {
    console.error('[Knight] Unexpected sentiment error:', err);
    return {
      score: 5,
      priority: 'medium',
      intent: 'general',
      keywords: [],
      requiresEscalation: false,
    };
  }
}

/**
 * Generate a response using Claude with knowledge base context
 */
export async function generateResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'knight'; content: string }>,
  knowledgeContext: KnowledgeContext[],
  channel: string,
  sentiment?: SentimentAnalysis
): Promise<KnightResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('knight-analyze', {
      body: {
        action: 'generate_response',
        message: userMessage,
        history: conversationHistory,
        knowledge: knowledgeContext,
        channel,
        sentiment,
        persona: channel === 'voice' ? KNIGHT_PERSONA_VOICE : KNIGHT_PERSONA_TEXT,
      },
    });

    if (error) {
      console.error('[Knight] Response generation error:', error);
      return {
        message: "I apologize, but I'm experiencing technical difficulties. Let me connect you with a human team member who can assist you immediately.",
        tone: 'apologetic',
        suggestedAction: 'escalate',
        confidence: 0,
      };
    }

    return data as KnightResponse;
  } catch (err) {
    console.error('[Knight] Unexpected response error:', err);
    return {
      message: "I apologize for the inconvenience. A team member will reach out to you shortly.",
      tone: 'apologetic',
      suggestedAction: 'escalate',
      confidence: 0,
    };
  }
}

/**
 * Search knowledge base for relevant context
 */
export async function searchKnowledge(
  workspaceId: string,
  query: string,
  limit: number = 5
): Promise<KnowledgeContext[]> {
  try {
    // First, get embedding for the query
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke('knight-analyze', {
      body: {
        action: 'get_embedding',
        text: query,
      },
    });

    if (embeddingError || !embeddingData?.embedding) {
      console.error('[Knight] Embedding error:', embeddingError);
      return [];
    }

    // Search knowledge base with embedding
    const { data, error } = await supabase.rpc('search_knowledge_base', {
      p_workspace_id: workspaceId,
      p_query_embedding: embeddingData.embedding,
      p_match_threshold: 0.7,
      p_match_count: limit,
    });

    if (error) {
      console.error('[Knight] Knowledge search error:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      content: item.content,
      category: item.category,
      title: item.title,
      similarity: item.similarity,
    }));
  } catch (err) {
    console.error('[Knight] Unexpected knowledge search error:', err);
    return [];
  }
}

/**
 * Process an incoming message through the Knight pipeline
 */
export async function processMessage(
  workspaceId: string,
  ticketId: string,
  message: string,
  channel: string,
  history: Array<{ role: 'user' | 'knight'; content: string }> = []
): Promise<{
  response: KnightResponse;
  sentiment: SentimentAnalysis;
  shouldEscalate: boolean;
}> {
  // Step 1: Analyze sentiment
  const sentiment = await analyzeSentiment(message);

  // Step 2: Search knowledge base
  const knowledge = await searchKnowledge(workspaceId, message);

  // Step 3: Generate response
  const response = await generateResponse(message, history, knowledge, channel, sentiment);

  // Step 4: Determine if escalation is needed
  const shouldEscalate =
    sentiment.requiresEscalation ||
    sentiment.score <= 2 ||
    response.suggestedAction === 'escalate' ||
    response.suggestedAction === 'voice_call';

  return {
    response,
    sentiment,
    shouldEscalate,
  };
}

/**
 * Get the Knight persona prompt for a channel
 */
export function getPersonaPrompt(channel: string, customPrompt?: string): string {
  if (customPrompt) {
    return customPrompt;
  }
  return channel === 'voice' ? KNIGHT_PERSONA_VOICE : KNIGHT_PERSONA_TEXT;
}

/**
 * Format conversation history for Claude
 */
export function formatConversationHistory(
  messages: Array<{ sender_type: string; content: string }>
): Array<{ role: 'user' | 'knight'; content: string }> {
  return messages.map((msg) => ({
    role: msg.sender_type === 'user' ? 'user' : 'knight',
    content: msg.content,
  }));
}
