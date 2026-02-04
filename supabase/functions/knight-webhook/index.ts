// Knight Webhook Handler
// Receives incoming messages from all channels (Social, Email, WhatsApp)
// As per TRD: POST /webhook/knight/social, /webhook/knight/outlook, /webhook/knight/whatsapp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SBASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SBASE_SERVICE_ROLE_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
};

// Channel types
type Channel = 'twitter' | 'linkedin' | 'outlook' | 'whatsapp' | 'instagram' | 'facebook' | 'voice';

interface SocialPayload {
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook';
  user_handle: string;
  content: string;
  post_url?: string;
  is_dm?: boolean;
  workspace_id?: string;
}

interface OutlookPayload {
  from: string;
  subject: string;
  body: string;
  thread_id?: string;
  workspace_id?: string;
}

interface WhatsAppPayload {
  From: string;
  Body: string;
  ProfileName?: string;
  WaId?: string;
  workspace_id?: string;
}

const VERIFY_TOKEN = 'knight_whatsapp_verify_2024';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const channel = pathParts[pathParts.length - 1]; // social, outlook, whatsapp, whatsapp-meta

  // Handle Meta WhatsApp webhook verification (GET request)
  if (req.method === 'GET' && (channel === 'whatsapp-meta' || channel === 'whatsapp')) {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[Knight] Meta webhook verification:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Knight] Webhook verified successfully');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    } else {
      console.log('[Knight] Webhook verification failed');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }
  }

  try {
    // Get workspace ID from header or body
    let workspaceId = req.headers.get('x-workspace-id');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    let result;

    switch (channel) {
      case 'social':
        result = await handleSocialWebhook(req, supabase, workspaceId);
        break;
      case 'outlook':
        result = await handleOutlookWebhook(req, supabase, workspaceId);
        break;
      case 'whatsapp':
        result = await handleWhatsAppWebhook(req, supabase, workspaceId);
        break;
      case 'whatsapp-meta':
        result = await handleMetaWhatsAppWebhook(req, supabase, workspaceId);
        break;
      default:
        // Try to parse as generic webhook
        result = await handleGenericWebhook(req, supabase, workspaceId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Knight webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================
// MODULE A: The Watchtower (Social Webhooks)
// ============================================
async function handleSocialWebhook(req: Request, supabase: any, workspaceId: string | null) {
  const payload: SocialPayload = await req.json();
  workspaceId = workspaceId || payload.workspace_id;

  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  console.log('[Knight] Social webhook received:', payload.platform, payload.user_handle);

  // 1. Analyze sentiment
  const sentiment = await analyzeSentiment(payload.content);

  // 2. Determine priority based on sentiment
  const priority = sentiment.score <= 3 ? 'critical' : sentiment.score <= 5 ? 'medium' : 'low';

  // 3. Create ticket
  const { data: ticket, error: ticketError } = await supabase.rpc('create_knight_ticket', {
    p_workspace_id: workspaceId,
    p_source_channel: payload.platform,
    p_source_handle: payload.user_handle,
    p_content: payload.content,
    p_sentiment_score: sentiment.score,
    p_priority: priority,
    p_metadata: {
      post_url: payload.post_url,
      is_dm: payload.is_dm,
      intent: sentiment.intent,
      keywords: sentiment.keywords,
    },
  });

  if (ticketError) {
    console.error('[Knight] Create ticket error:', ticketError);
    throw ticketError;
  }

  // 4. Generate response if critical
  let response = null;
  if (priority === 'critical' || priority === 'medium') {
    response = await generateResponse(payload.content, [], sentiment, payload.platform);

    // Add Knight's response to ticket
    await supabase.rpc('add_knight_message', {
      p_ticket_id: ticket.id,
      p_sender_type: 'knight',
      p_content: response.message,
      p_metadata: { tone: response.tone, confidence: response.confidence },
    });
  }

  return {
    success: true,
    ticket_id: ticket.id,
    sentiment,
    priority,
    response: response?.message,
    action: response ? 'auto_replied' : 'ticket_created',
  };
}

// ============================================
// MODULE B: The Diplomat (Outlook)
// ============================================
async function handleOutlookWebhook(req: Request, supabase: any, workspaceId: string | null) {
  const payload: OutlookPayload = await req.json();
  workspaceId = workspaceId || payload.workspace_id;

  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  console.log('[Knight] Outlook webhook received:', payload.from);

  const fullContent = `Subject: ${payload.subject}\n\n${payload.body}`;

  // 1. Check for existing ticket from this sender
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('source_handle', payload.from)
    .eq('source_channel', 'outlook')
    .in('status', ['open', 'pending_user'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Analyze sentiment
  const sentiment = await analyzeSentiment(fullContent);
  const priority = sentiment.score <= 3 ? 'critical' : sentiment.score <= 5 ? 'medium' : 'low';

  let ticketId: string;

  if (existingTicket) {
    // Add message to existing ticket
    ticketId = existingTicket.id;
    await supabase.rpc('add_knight_message', {
      p_ticket_id: ticketId,
      p_sender_type: 'user',
      p_content: fullContent,
      p_metadata: { subject: payload.subject, thread_id: payload.thread_id },
    });

    // Update ticket sentiment
    await supabase
      .from('tickets')
      .update({ sentiment_score: sentiment.score, priority, updated_at: new Date().toISOString() })
      .eq('id', ticketId);
  } else {
    // Create new ticket
    const { data: ticket, error } = await supabase.rpc('create_knight_ticket', {
      p_workspace_id: workspaceId,
      p_source_channel: 'outlook',
      p_source_handle: payload.from,
      p_content: fullContent,
      p_sentiment_score: sentiment.score,
      p_priority: priority,
      p_metadata: { subject: payload.subject, thread_id: payload.thread_id },
    });

    if (error) throw error;
    ticketId = ticket.id;
  }

  // 3. Search knowledge base and generate response
  const knowledge = await searchKnowledgeBase(supabase, workspaceId, fullContent);
  const response = await generateResponse(fullContent, knowledge, sentiment, 'outlook');

  // 4. Add response to ticket
  await supabase.rpc('add_knight_message', {
    p_ticket_id: ticketId,
    p_sender_type: 'knight',
    p_content: response.message,
    p_metadata: { tone: response.tone, confidence: response.confidence },
  });

  // 5. Check if voice escalation needed
  let escalated = false;
  if (sentiment.score <= 2 && response.suggestedAction === 'voice_call') {
    await supabase
      .from('tickets')
      .update({ status: 'escalated', escalated_at: new Date().toISOString() })
      .eq('id', ticketId);
    escalated = true;
  }

  return {
    success: true,
    ticket_id: ticketId,
    is_new_ticket: !existingTicket,
    sentiment,
    priority,
    response: response.message,
    escalated,
  };
}

// ============================================
// MODULE B: The Diplomat (WhatsApp via Twilio)
// ============================================
async function handleWhatsAppWebhook(req: Request, supabase: any, workspaceId: string | null) {
  // Twilio sends form-urlencoded data
  const contentType = req.headers.get('content-type') || '';
  let payload: WhatsAppPayload;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData();
    payload = {
      From: formData.get('From') as string,
      Body: formData.get('Body') as string,
      ProfileName: formData.get('ProfileName') as string,
      WaId: formData.get('WaId') as string,
    };
  } else {
    payload = await req.json();
  }

  // Extract phone number (remove whatsapp: prefix)
  const phoneNumber = payload.From?.replace('whatsapp:', '') || payload.WaId;
  const customerName = payload.ProfileName || 'WhatsApp User';

  workspaceId = workspaceId || payload.workspace_id;

  if (!workspaceId) {
    // Try to get default workspace or return TwiML response
    return {
      success: false,
      error: 'workspace_id is required',
      twiml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    };
  }

  console.log('[Knight] WhatsApp webhook received:', phoneNumber);

  // 1. Check for existing conversation
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('source_handle', phoneNumber)
    .eq('source_channel', 'whatsapp')
    .in('status', ['open', 'pending_user'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Analyze sentiment
  const sentiment = await analyzeSentiment(payload.Body);
  const priority = sentiment.score <= 3 ? 'critical' : sentiment.score <= 5 ? 'medium' : 'low';

  let ticketId: string;
  let conversationHistory: any[] = [];

  if (existingTicket) {
    ticketId = existingTicket.id;

    // Get conversation history
    const { data: messages } = await supabase
      .from('ticket_messages')
      .select('sender_type, content')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    conversationHistory = (messages || []).map((m: any) => ({
      role: m.sender_type === 'user' ? 'user' : 'knight',
      content: m.content,
    }));

    // Add new message
    await supabase.rpc('add_knight_message', {
      p_ticket_id: ticketId,
      p_sender_type: 'user',
      p_content: payload.Body,
      p_metadata: { customer_name: customerName },
    });

    // Update sentiment
    await supabase
      .from('tickets')
      .update({ sentiment_score: sentiment.score, priority, updated_at: new Date().toISOString() })
      .eq('id', ticketId);
  } else {
    // Create new ticket
    const { data: ticket, error } = await supabase.rpc('create_knight_ticket', {
      p_workspace_id: workspaceId,
      p_source_channel: 'whatsapp',
      p_source_handle: phoneNumber,
      p_content: payload.Body,
      p_sentiment_score: sentiment.score,
      p_priority: priority,
      p_metadata: { customer_name: customerName, wa_id: payload.WaId },
    });

    if (error) throw error;
    ticketId = ticket.id;
  }

  // 3. Search knowledge base
  const knowledge = await searchKnowledgeBase(supabase, workspaceId, payload.Body);

  // 4. Generate response with conversation context
  const response = await generateResponse(payload.Body, knowledge, sentiment, 'whatsapp', conversationHistory);

  // 5. Add response to ticket
  await supabase.rpc('add_knight_message', {
    p_ticket_id: ticketId,
    p_sender_type: 'knight',
    p_content: response.message,
    p_metadata: { tone: response.tone, confidence: response.confidence },
  });

  // 6. Check for voice escalation (Module C: The Last Resort)
  let escalated = false;
  const messageCount = conversationHistory.length + 1;

  if (
    sentiment.score <= 2 ||
    (sentiment.score <= 3 && messageCount >= 3) ||
    response.suggestedAction === 'voice_call'
  ) {
    // Trigger voice call via Vapi
    await triggerVoiceEscalation(supabase, workspaceId, ticketId, phoneNumber, customerName, payload.Body);
    escalated = true;
  }

  // Return TwiML response for Twilio
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(response.message)}</Message>
</Response>`;

  return {
    success: true,
    ticket_id: ticketId,
    sentiment,
    response: response.message,
    escalated,
    twiml,
  };
}

// ============================================
// MODULE B: Meta WhatsApp Business API
// ============================================
async function handleMetaWhatsAppWebhook(req: Request, supabase: any, workspaceId: string | null) {
  const payload = await req.json();

  console.log('[Knight] Meta WhatsApp webhook:', JSON.stringify(payload, null, 2));

  // Meta sends webhooks in this structure
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value) {
    return { success: true, message: 'No message data' };
  }

  // Handle incoming messages
  const messages = value.messages;
  if (!messages || messages.length === 0) {
    // Could be a status update, not a message
    const statuses = value.statuses;
    if (statuses) {
      console.log('[Knight] Message status update:', statuses);
      return { success: true, message: 'Status update received' };
    }
    return { success: true, message: 'No messages' };
  }

  const contacts = value.contacts || [];
  const metadata = value.metadata;

  // Get workspace from meta integration
  if (!workspaceId && metadata?.phone_number_id) {
    const { data: integration } = await supabase
      .from('meta_integrations')
      .select('workspace_id')
      .eq('facebook_user_id', metadata.phone_number_id)
      .single();

    if (integration) {
      workspaceId = integration.workspace_id;
    }
  }

  // Fallback: get first workspace (for testing)
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    workspaceId = workspace?.id;
  }

  if (!workspaceId) {
    console.error('[Knight] No workspace found for Meta WhatsApp webhook');
    return { success: false, error: 'No workspace configured' };
  }

  const results = [];

  for (const message of messages) {
    const phoneNumber = message.from;
    const messageText = message.text?.body || message.caption || '[Media message]';
    const messageType = message.type; // text, image, audio, video, document, etc.
    const contact = contacts.find((c: any) => c.wa_id === phoneNumber);
    const customerName = contact?.profile?.name || 'WhatsApp User';

    console.log('[Knight] Processing message from:', phoneNumber, messageText);

    // Check for existing ticket
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('source_handle', phoneNumber)
      .eq('source_channel', 'whatsapp')
      .in('status', ['open', 'pending_user'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Analyze sentiment
    const sentiment = await analyzeSentiment(messageText);
    const priority = sentiment.score <= 3 ? 'critical' : sentiment.score <= 5 ? 'medium' : 'low';

    let ticketId: string;
    let conversationHistory: any[] = [];

    if (existingTicket) {
      ticketId = existingTicket.id;

      // Get history
      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('sender_type, content')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      conversationHistory = (msgs || []).map((m: any) => ({
        role: m.sender_type === 'user' ? 'user' : 'knight',
        content: m.content,
      }));

      // Add new message
      await supabase.rpc('add_knight_message', {
        p_ticket_id: ticketId,
        p_sender_type: 'user',
        p_content: messageText,
        p_metadata: { customer_name: customerName, message_type: messageType, wa_message_id: message.id },
      });

      // Update sentiment
      await supabase
        .from('tickets')
        .update({ sentiment_score: sentiment.score, priority, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    } else {
      // Create new ticket
      const { data: ticket, error } = await supabase.rpc('create_knight_ticket', {
        p_workspace_id: workspaceId,
        p_source_channel: 'whatsapp',
        p_source_handle: phoneNumber,
        p_content: messageText,
        p_sentiment_score: sentiment.score,
        p_priority: priority,
        p_metadata: { customer_name: customerName, message_type: messageType, wa_message_id: message.id },
      });

      if (error) {
        console.error('[Knight] Create ticket error:', error);
        continue;
      }
      ticketId = ticket.id;
    }

    // Search knowledge base
    const knowledge = await searchKnowledgeBase(supabase, workspaceId, messageText);

    // Generate response
    const response = await generateResponse(messageText, knowledge, sentiment, 'whatsapp', conversationHistory);

    // Save Knight's response
    await supabase.rpc('add_knight_message', {
      p_ticket_id: ticketId,
      p_sender_type: 'knight',
      p_content: response.message,
      p_metadata: { tone: response.tone, confidence: response.confidence },
    });

    // Send reply via Meta WhatsApp API
    if (metadata?.phone_number_id) {
      await sendMetaWhatsAppReply(metadata.phone_number_id, phoneNumber, response.message);
    }

    results.push({
      ticket_id: ticketId,
      from: phoneNumber,
      sentiment,
      response: response.message,
    });
  }

  return { success: true, processed: results.length, results };
}

// Send reply via Meta WhatsApp Cloud API
async function sendMetaWhatsAppReply(phoneNumberId: string, to: string, message: string) {
  const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');

  if (!META_ACCESS_TOKEN) {
    console.error('[Knight] META_ACCESS_TOKEN not set');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();
    console.log('[Knight] WhatsApp reply sent:', data);
  } catch (error) {
    console.error('[Knight] Failed to send WhatsApp reply:', error);
  }
}

// ============================================
// Generic webhook handler
// ============================================
async function handleGenericWebhook(req: Request, supabase: any, workspaceId: string | null) {
  const payload = await req.json();
  workspaceId = workspaceId || payload.workspace_id;

  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  const channel = payload.channel || payload.platform || 'unknown';
  const handle = payload.user_handle || payload.from || payload.sender || 'unknown';
  const content = payload.content || payload.message || payload.body || payload.text || '';

  const sentiment = await analyzeSentiment(content);
  const priority = sentiment.score <= 3 ? 'critical' : sentiment.score <= 5 ? 'medium' : 'low';

  const { data: ticket, error } = await supabase.rpc('create_knight_ticket', {
    p_workspace_id: workspaceId,
    p_source_channel: channel,
    p_source_handle: handle,
    p_content: content,
    p_sentiment_score: sentiment.score,
    p_priority: priority,
    p_metadata: payload,
  });

  if (error) throw error;

  return {
    success: true,
    ticket_id: ticket.id,
    sentiment,
    priority,
  };
}

// ============================================
// AI Functions
// ============================================
async function analyzeSentiment(message: string) {
  if (!ANTHROPIC_API_KEY) {
    return { score: 5, intent: 'general', keywords: [], requiresEscalation: false };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Analyze sentiment. Return JSON only:
{"score":<1-10>,"intent":"<complaint|question|urgent|feedback|general>","keywords":[<words>],"requiresEscalation":<bool>}

Message: "${message}"`,
        }],
      }),
    });

    const data = await response.json();
    return JSON.parse(data.content?.[0]?.text || '{"score":5,"intent":"general","keywords":[],"requiresEscalation":false}');
  } catch {
    return { score: 5, intent: 'general', keywords: [], requiresEscalation: false };
  }
}

async function generateResponse(
  message: string,
  knowledge: any[],
  sentiment: any,
  channel: string,
  history: any[] = []
) {
  if (!ANTHROPIC_API_KEY) {
    return {
      message: "Thank you for reaching out. A team member will assist you shortly.",
      tone: 'professional',
      confidence: 0.5,
    };
  }

  const knowledgeContext = knowledge.length
    ? knowledge.map(k => `[${k.category}] ${k.content}`).join('\n')
    : 'No specific knowledge base context.';

  const historyText = history.length
    ? history.map(h => `${h.role === 'user' ? 'Customer' : 'Knight'}: ${h.content}`).join('\n')
    : '';

  let toneGuidance = '';
  if (sentiment.score <= 3) {
    toneGuidance = 'Customer is upset. Lead with empathy, apologize sincerely.';
  } else if (sentiment.score <= 5) {
    toneGuidance = 'Customer has concerns. Be professional and solution-focused.';
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: `You are The Knight, a Customer Success Agent. Be concise, empathetic, solution-focused.
${toneGuidance}
Knowledge: ${knowledgeContext}
${historyText ? `History:\n${historyText}` : ''}
Channel: ${channel} (keep response appropriate)
Return JSON: {"message":"<reply>","tone":"<empathetic|professional|apologetic>","suggestedAction":"<reply|escalate|voice_call>","confidence":<0-1>}`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    return JSON.parse(data.content?.[0]?.text || '{"message":"A team member will assist you shortly.","tone":"professional","confidence":0.5}');
  } catch {
    return {
      message: "Thank you for reaching out. A team member will assist you shortly.",
      tone: 'professional',
      confidence: 0.5,
    };
  }
}

async function searchKnowledgeBase(supabase: any, workspaceId: string, query: string) {
  // Simple text search since we may not have embeddings set up
  const { data } = await supabase
    .from('knowledge_base')
    .select('content, category, title')
    .eq('workspace_id', workspaceId)
    .textSearch('content', query.split(' ').slice(0, 5).join(' | '))
    .limit(3);

  return data || [];
}

async function triggerVoiceEscalation(
  supabase: any,
  workspaceId: string,
  ticketId: string,
  phoneNumber: string,
  customerName: string,
  issueSummary: string
) {
  // Update ticket status
  await supabase
    .from('tickets')
    .update({ status: 'escalated', escalated_at: new Date().toISOString() })
    .eq('id', ticketId);

  // Log activity
  await supabase.from('knight_activity_log').insert({
    workspace_id: workspaceId,
    ticket_id: ticketId,
    action_type: 'voice_call',
    channel: 'voice',
    details: { phone_number: phoneNumber, customer_name: customerName, triggered_by: 'auto_escalation' },
  });

  // Trigger Vapi call (if configured)
  const VAPI_KEY = Deno.env.get('VAPI_PRIVATE_KEY');
  const VAPI_PHONE_ID = Deno.env.get('VAPI_PHONE_NUMBER_ID');

  if (VAPI_KEY && VAPI_PHONE_ID) {
    try {
      await fetch('https://api.vapi.ai/call/phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${VAPI_KEY}`,
        },
        body: JSON.stringify({
          phoneNumberId: VAPI_PHONE_ID,
          customer: { number: phoneNumber, name: customerName },
          assistant: {
            model: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', systemPrompt: `You are calling ${customerName} about: ${issueSummary}. Be apologetic and helpful.` },
            voice: { provider: 'openai', voiceId: 'nova' },
            firstMessage: `Hi ${customerName}, this is support from Regent. I saw your message and wanted to reach out personally.`,
          },
          metadata: { ticket_id: ticketId },
        }),
      });
    } catch (e) {
      console.error('[Knight] Vapi call error:', e);
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
