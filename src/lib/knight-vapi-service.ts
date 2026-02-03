/**
 * Knight Vapi Voice Service
 * Handles voice escalation via Vapi.ai for The Knight
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface VapiCallParams {
  phoneNumber: string;
  ticketId: string;
  customerName?: string;
  issueSummary: string;
  assistantId?: string;
}

export interface VapiCallResult {
  success: boolean;
  callId?: string;
  error?: string;
}

export interface VapiAssistantConfig {
  name: string;
  model: string;
  voice: string;
  systemPrompt: string;
  firstMessage: string;
  endCallPhrases: string[];
}

// Default Knight Voice Persona
const DEFAULT_KNIGHT_VOICE_PROMPT = `Role: You are a senior support rep for Regent. You are calling a customer who just left a complaint or is having issues.

Tone: Calm, apologetic, highly competent.

Instructions:
- Introduce yourself: "Hi, this is the Support Team at Regent. I saw your message and wanted to reach out personally."
- Listen to their complaint fully before responding
- Acknowledge their frustration: "I completely understand why that would be frustrating."
- Offer concrete solutions: a refund, immediate fix, or escalation to engineering
- Do not interrupt them while they are venting
- Stay calm even if they are angry
- End with a clear next step and timeline

Issue Context: {{issue_summary}}
Customer Name: {{customer_name}}`;

const DEFAULT_FIRST_MESSAGE = "Hi, this is the support team from Regent. I noticed you reached out about an issue, and I wanted to personally follow up to make sure we get this resolved for you. How can I help?";

/**
 * Initiate an outbound voice call via Vapi
 */
export async function initiateVoiceCall(params: VapiCallParams): Promise<VapiCallResult> {
  try {
    // Call the edge function to initiate the Vapi call
    const { data, error } = await supabase.functions.invoke('knight-voice-call', {
      body: {
        phone_number: params.phoneNumber,
        ticket_id: params.ticketId,
        customer_name: params.customerName || 'Valued Customer',
        issue_summary: params.issueSummary,
        assistant_id: params.assistantId,
      },
    });

    if (error) {
      console.error('[Knight Voice] Call initiation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initiate voice call',
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    // Log the voice call activity
    await logVoiceActivity(params.ticketId, data.call_id, 'initiated');

    return {
      success: true,
      callId: data.call_id,
    };
  } catch (err) {
    console.error('[Knight Voice] Unexpected call error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Log voice call activity
 */
async function logVoiceActivity(
  ticketId: string,
  callId: string,
  status: 'initiated' | 'completed' | 'failed'
): Promise<void> {
  try {
    // Get workspace ID from ticket
    const { data: ticket } = await (supabase as any)
      .from('tickets')
      .select('workspace_id, source_channel')
      .eq('id', ticketId)
      .single();

    if (ticket) {
      await (supabase as any)
        .from('knight_activity_log')
        .insert({
          workspace_id: ticket.workspace_id,
          ticket_id: ticketId,
          action_type: 'voice_call',
          channel: 'voice',
          details: {
            call_id: callId,
            status,
            original_channel: ticket.source_channel,
          },
        });
    }
  } catch (err) {
    console.error('[Knight Voice] Activity log error:', err);
  }
}

/**
 * Get call status from Vapi
 */
export async function getCallStatus(callId: string): Promise<{
  status: string;
  duration?: number;
  transcript?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('knight-voice-call', {
      body: {
        action: 'get_status',
        call_id: callId,
      },
    });

    if (error) {
      return { status: 'unknown', error: error.message };
    }

    return {
      status: data.status || 'unknown',
      duration: data.duration,
      transcript: data.transcript,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Create or update a Vapi assistant configuration
 */
export async function configureVapiAssistant(
  workspaceId: string,
  config: Partial<VapiAssistantConfig>
): Promise<{ assistantId: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('knight-voice-call', {
      body: {
        action: 'configure_assistant',
        workspace_id: workspaceId,
        config: {
          name: config.name || 'Knight Support Agent',
          model: config.model || 'claude-3-5-sonnet',
          voice: config.voice || 'nova',
          system_prompt: config.systemPrompt || DEFAULT_KNIGHT_VOICE_PROMPT,
          first_message: config.firstMessage || DEFAULT_FIRST_MESSAGE,
          end_call_phrases: config.endCallPhrases || [
            'goodbye',
            'have a good day',
            'thank you for calling',
          ],
        },
      },
    });

    if (error) {
      return { assistantId: '', error: error.message };
    }

    return { assistantId: data.assistant_id };
  } catch (err) {
    return {
      assistantId: '',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check if voice escalation should be triggered
 */
export function shouldEscalateToVoice(
  sentimentScore: number,
  messageCount: number,
  hasPhoneNumber: boolean,
  voiceEscalationEnabled: boolean,
  sentimentThreshold: number = 3
): boolean {
  if (!voiceEscalationEnabled || !hasPhoneNumber) {
    return false;
  }

  // Escalate if:
  // 1. Sentiment is critical (below threshold)
  // 2. AND conversation has gone back and forth (3+ messages)
  if (sentimentScore <= sentimentThreshold && messageCount >= 3) {
    return true;
  }

  // Or if sentiment is extremely low (1-2), escalate immediately
  if (sentimentScore <= 2) {
    return true;
  }

  return false;
}

/**
 * Extract phone number from various formats
 */
export function extractPhoneNumber(input: string): string | null {
  // Remove all non-numeric characters except +
  const cleaned = input.replace(/[^\d+]/g, '');

  // Check if it looks like a valid phone number (at least 10 digits)
  if (cleaned.replace('+', '').length >= 10) {
    // Add + if not present for international format
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  return null;
}

/**
 * Get default voice configuration
 */
export function getDefaultVoiceConfig(): VapiAssistantConfig {
  return {
    name: 'Knight Support Agent',
    model: 'claude-3-5-sonnet',
    voice: 'nova',
    systemPrompt: DEFAULT_KNIGHT_VOICE_PROMPT,
    firstMessage: DEFAULT_FIRST_MESSAGE,
    endCallPhrases: ['goodbye', 'have a good day', 'thank you for calling'],
  };
}
