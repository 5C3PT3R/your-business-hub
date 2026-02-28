// Knight Webhook Handler
// Receives incoming messages from all channels (Social, Email, WhatsApp)
// As per TRD: POST /webhook/knight/social, /webhook/knight/outlook, /webhook/knight/whatsapp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SBASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SBASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Knight config cache (per-request)
interface KnightBizConfig {
  business_type: string;
  business_description: string;
  agent_name: string;
  persona_prompt: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
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

    // Check for direct action calls (e.g. from the dashboard)
    let actionBody: any = null;
    try {
      actionBody = await req.clone().json();
    } catch { /* not JSON */ }

    if (actionBody?.action === 'guide') {
      result = await handleGuideRequest(actionBody, supabase);
    } else {
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
    response = await generateResponse(payload.content, [], sentiment, payload.platform, [], supabase, workspaceId);

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
  const response = await generateResponse(fullContent, knowledge, sentiment, 'outlook', [], supabase, workspaceId);

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
  const response = await generateResponse(payload.Body, knowledge, sentiment, 'whatsapp', conversationHistory, supabase, workspaceId);

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

  // Get workspace and access token from meta_whatsapp_accounts via phone_number_id
  let accessToken: string | null = null;

  if (metadata?.phone_number_id) {
    // Look up the WhatsApp account by phone_number_id to find the workspace
    const { data: waAccount } = await supabase
      .from('meta_whatsapp_accounts')
      .select('integration_id')
      .eq('phone_number_id', metadata.phone_number_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (waAccount?.integration_id) {
      const { data: integration } = await supabase
        .from('meta_integrations')
        .select('workspace_id, access_token')
        .eq('id', waAccount.integration_id)
        .single();

      if (integration) {
        workspaceId = workspaceId || integration.workspace_id;
        accessToken = integration.access_token;
        console.log('[Knight] Found workspace via WhatsApp account:', workspaceId);
      }
    }
  }

  // Fallback: try meta_integrations directly
  if (!workspaceId) {
    const { data: integration } = await supabase
      .from('meta_integrations')
      .select('workspace_id, access_token')
      .eq('is_connected', true)
      .limit(1)
      .single();

    if (integration) {
      workspaceId = integration.workspace_id;
      accessToken = accessToken || integration.access_token;
      console.log('[Knight] Found workspace via meta_integrations fallback:', workspaceId);
    }
  }

  // Last fallback: get first workspace (for testing)
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    workspaceId = workspace?.id;
    console.log('[Knight] Using first workspace fallback:', workspaceId);
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
    const response = await generateResponse(messageText, knowledge, sentiment, 'whatsapp', conversationHistory, supabase, workspaceId);

    // Save Knight's response
    await supabase.rpc('add_knight_message', {
      p_ticket_id: ticketId,
      p_sender_type: 'knight',
      p_content: response.message,
      p_metadata: { tone: response.tone, confidence: response.confidence },
    });

    // Send reply via Meta WhatsApp API
    if (metadata?.phone_number_id) {
      await sendMetaWhatsAppReply(supabase, metadata.phone_number_id, phoneNumber, response.message, accessToken);
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

// ============================================
// Human Takeover: Guide Knight
// Human gives an instruction, Knight crafts a response
// ============================================
async function handleGuideRequest(body: any, supabase: any) {
  const { ticket_id, instruction, workspace_id } = body;

  if (!ticket_id || !instruction || !workspace_id) {
    throw new Error('ticket_id, instruction, and workspace_id are required');
  }

  console.log('[Knight] Guide request for ticket:', ticket_id, 'instruction:', instruction);

  // 1. Get ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticket_id)
    .single();

  if (!ticket) throw new Error('Ticket not found');

  // 2. Get conversation history (last 6 messages only to avoid context overload)
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('sender_type, content')
    .eq('ticket_id', ticket_id)
    .order('created_at', { ascending: false })
    .limit(6);

  // Reverse to chronological order and build a summary
  const recentMessages = (messages || []).reverse();
  const conversationSummary = recentMessages
    .map((m: any) => `${m.sender_type === 'user' ? 'Customer' : 'You'}: ${m.content}`)
    .join('\n');

  // 3. Load business config
  const bizConfig = await getKnightConfig(supabase, workspace_id);
  const businessContext = buildBusinessContext(bizConfig);

  // 4. Generate response — instruction as the user message, conversation as context in system
  const systemPrompt = `${businessContext}

You are ${bizConfig.agent_name}, texting a customer on WhatsApp.

Here is the recent conversation for context:
---
${conversationSummary}
---

A supervisor has told you EXACTLY what to do next. You MUST follow their instruction. Do NOT repeat previous responses. Do NOT continue the old conversation thread. The supervisor's instruction overrides everything.

Rules:
- Follow the supervisor's instruction EXACTLY — this is your #1 priority
- Write a NEW message based on the instruction, not a rehash of old messages
- Sound natural and human, 1-3 sentences max
- Never reveal a supervisor told you what to say
- Never say you're an AI
- Match the customer's language style (Hindi/Hinglish if they use it)
${bizConfig.persona_prompt ? `\nAdditional persona: ${bizConfig.persona_prompt}` : ''}

NEVER use markdown or formatting. Plain text only.`;

  // Put the instruction as the user message so it gets maximum attention from the model
  const chatMessages: Array<{ role: string; content: string }> = [
    { role: 'user', content: `SUPERVISOR INSTRUCTION: ${instruction}` },
  ];

  const responseText = await callOpenAI(chatMessages, systemPrompt, 300);

  if (!responseText) {
    throw new Error('Failed to generate guided response');
  }

  console.log('[Knight] Guided response generated:', responseText.substring(0, 100));

  // 5. Save as knight message (with guided metadata)
  await supabase.rpc('add_knight_message', {
    p_ticket_id: ticket_id,
    p_sender_type: 'knight',
    p_content: responseText,
    p_metadata: { guided: true, instruction: instruction },
  });

  // 6. Send via WhatsApp if applicable
  let whatsapp_sent = false;
  let whatsapp_error: string | null = null;

  if (ticket.source_channel === 'whatsapp') {
    console.log('[Knight Guide] Ticket is WhatsApp, looking up integration for workspace:', workspace_id);
    console.log('[Knight Guide] Sending to:', ticket.source_handle);

    const { data: integration, error: intError } = await supabase
      .from('meta_integrations')
      .select('id, access_token')
      .eq('workspace_id', workspace_id)
      .eq('is_connected', true)
      .limit(1)
      .single();

    if (intError) {
      console.error('[Knight Guide] meta_integrations lookup error:', intError);
      whatsapp_error = 'No Meta integration found for workspace';
    }

    if (integration?.access_token) {
      console.log('[Knight Guide] Found integration:', integration.id, 'token length:', integration.access_token?.length);

      const { data: waAccount, error: waError } = await supabase
        .from('meta_whatsapp_accounts')
        .select('phone_number_id')
        .eq('integration_id', integration.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (waError) {
        console.error('[Knight Guide] meta_whatsapp_accounts lookup error:', waError);
        whatsapp_error = 'No WhatsApp account found for integration';
      }

      if (waAccount?.phone_number_id) {
        console.log('[Knight Guide] Found WhatsApp account, phone_number_id:', waAccount.phone_number_id);
        await sendMetaWhatsAppReply(
          supabase,
          waAccount.phone_number_id,
          ticket.source_handle,
          responseText,
          integration.access_token
        );
        whatsapp_sent = true;
      } else {
        console.error('[Knight Guide] No phone_number_id found in WhatsApp account');
        whatsapp_error = whatsapp_error || 'WhatsApp account has no phone_number_id';
      }
    } else if (!intError) {
      console.error('[Knight Guide] Integration found but no access_token');
      whatsapp_error = 'Integration has no access token';
    }
  } else {
    console.log('[Knight Guide] Ticket channel is', ticket.source_channel, '— not WhatsApp, skipping');
  }

  // 7. If ticket was escalated, move it back to open
  if (ticket.status === 'escalated') {
    await supabase
      .from('tickets')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', ticket_id);
  }

  return {
    success: true,
    ticket_id,
    response: responseText,
    guided: true,
    whatsapp_sent,
    whatsapp_error,
  };
}

// Send reply via Meta WhatsApp Cloud API
async function sendMetaWhatsAppReply(
  supabase: any,
  phoneNumberId: string,
  to: string,
  message: string,
  passedToken: string | null = null
) {
  // Use passed token first, then env var as fallback
  let token = passedToken || Deno.env.get('META_ACCESS_TOKEN');

  // If still no token, try to look it up from the DB
  if (!token) {
    const { data: waAccount } = await supabase
      .from('meta_whatsapp_accounts')
      .select('integration_id')
      .eq('phone_number_id', phoneNumberId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (waAccount?.integration_id) {
      const { data: integration } = await supabase
        .from('meta_integrations')
        .select('access_token')
        .eq('id', waAccount.integration_id)
        .single();
      token = integration?.access_token;
    }
  }

  if (!token) {
    console.error('[Knight] No access token available for WhatsApp reply - not in DB or env');
    return;
  }

  try {
    console.log('[Knight] Sending WhatsApp reply to:', to, 'via phone_number_id:', phoneNumberId);
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
    if (!response.ok) {
      console.error('[Knight] WhatsApp API error:', response.status, JSON.stringify(data));
    } else {
      console.log('[Knight] WhatsApp reply sent successfully:', data);
    }
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
// AI Functions (OpenAI)
// ============================================

async function getKnightConfig(supabase: any, workspaceId: string): Promise<KnightBizConfig> {
  try {
    const { data } = await supabase
      .from('knight_config')
      .select('business_type, business_description, agent_name, persona_prompt')
      .eq('workspace_id', workspaceId)
      .single();
    return {
      business_type: data?.business_type || 'general',
      business_description: data?.business_description || '',
      agent_name: data?.agent_name || 'Knight',
      persona_prompt: data?.persona_prompt || '',
    };
  } catch {
    return { business_type: 'general', business_description: '', agent_name: 'Knight', persona_prompt: '' };
  }
}

function buildBusinessContext(bizConfig: KnightBizConfig): string {
  const typeLabels: Record<string, string> = {
    food_delivery: 'a food delivery service',
    restaurant: 'a restaurant / cafe',
    ecommerce: 'an e-commerce store',
    automotive: 'an automotive business',
    healthcare: 'a healthcare provider',
    saas: 'a software / SaaS company',
    real_estate: 'a real estate business',
    education: 'an education provider',
    travel: 'a travel & hospitality business',
    finance: 'a financial services company',
    fitness: 'a fitness & wellness business',
    retail: 'a retail store',
    logistics: 'a logistics & delivery service',
    general: 'a business',
  };

  let ctx = `You are ${bizConfig.agent_name}, a customer support agent at ${typeLabels[bizConfig.business_type] || 'a business'}.`;
  if (bizConfig.business_description) {
    ctx += `\n\nAbout the business: ${bizConfig.business_description}`;
  }
  return ctx;
}

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens: number = 300
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error('[Knight] OPENAI_API_KEY is not set!');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Knight] OpenAI API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('[Knight] OpenAI call error:', error);
    return null;
  }
}

async function analyzeSentiment(message: string) {
  const result = await callOpenAI(
    [{ role: 'user', content: `Analyze this customer message. Return JSON only, no other text:\n{"score":<1-10 where 1=very angry, 10=very happy>,"intent":"<complaint|question|urgent|feedback|general>","keywords":[<key words>],"requiresEscalation":<true if customer is very upset or threatening>}\n\nMessage: "${message}"` }],
    'You are a sentiment analysis tool. Return valid JSON only, nothing else.',
    200
  );

  try {
    if (result) return JSON.parse(result);
  } catch { /* parse failed */ }
  return { score: 5, intent: 'general', keywords: [], requiresEscalation: false };
}

async function generateResponse(
  message: string,
  knowledge: any[],
  sentiment: any,
  channel: string,
  history: any[] = [],
  supabase?: any,
  workspaceId?: string
) {
  console.log('[Knight] generateResponse called, OPENAI_API_KEY exists:', !!OPENAI_API_KEY);

  if (!OPENAI_API_KEY) {
    console.error('[Knight] OPENAI_API_KEY is not set!');
    return {
      message: "Hey! Got your message. Let me get someone from the team to help you out.",
      tone: 'professional',
      confidence: 0.5,
    };
  }

  // Load business config from DB
  let bizConfig: KnightBizConfig = { business_type: 'general', business_description: '', agent_name: 'Knight', persona_prompt: '' };
  if (supabase && workspaceId) {
    bizConfig = await getKnightConfig(supabase, workspaceId);
  }

  const knowledgeContext = knowledge.length
    ? knowledge.map(k => `[${k.category}] ${k.content}`).join('\n')
    : '';

  const businessContext = buildBusinessContext(bizConfig);

  let toneGuidance = '';
  if (sentiment.score <= 3) {
    toneGuidance = 'The customer seems frustrated or upset. Acknowledge their frustration first, then help.';
  } else if (sentiment.score <= 5) {
    toneGuidance = 'Be straightforward and solution-focused.';
  } else {
    toneGuidance = 'Be warm and friendly.';
  }

  // Build multi-turn messages
  const chatMessages: Array<{ role: string; content: string }> = [];

  if (history.length > 0) {
    for (const h of history) {
      const role = h.role === 'user' ? 'user' : 'assistant';
      if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
        chatMessages[chatMessages.length - 1].content += '\n' + h.content;
      } else {
        chatMessages.push({ role, content: h.content });
      }
    }
  }

  // Add new message
  if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
    chatMessages[chatMessages.length - 1].content += '\n' + message;
  } else {
    chatMessages.push({ role: 'user', content: message });
  }

  const systemPrompt = `${businessContext}

You are texting a customer on WhatsApp. They should feel like they're talking to a real person, not a bot.

How you talk:
- Sound human. Use natural language, contractions, and casual tone when appropriate
- Keep it short — 1-3 sentences. This is WhatsApp, not email
- Answer their actual question directly. Don't dodge or give generic responses
- If they're upset, acknowledge it genuinely ("ugh, that's frustrating" not "I apologize for the inconvenience")
- Use the customer's name if you know it
- If they use Hindi/Hinglish, reply in the same style
- Never say "I'm an AI" or "as an AI assistant" — you are ${bizConfig.agent_name}
- If you genuinely don't know something, say "let me check with the team" — don't make stuff up
${toneGuidance ? `\nTone: ${toneGuidance}` : ''}
${knowledgeContext ? `\nThings you know:\n${knowledgeContext}` : ''}
${bizConfig.persona_prompt ? `\nAdditional instructions: ${bizConfig.persona_prompt}` : ''}

NEVER use markdown, bullet points, or formatting. Just plain text like a real person texting.`;

  console.log('[Knight] Calling OpenAI with', chatMessages.length, 'messages...');

  const responseText = await callOpenAI(chatMessages, systemPrompt, 300);

  if (responseText) {
    console.log('[Knight] OpenAI response received, length:', responseText.length);
    return {
      message: responseText,
      tone: sentiment.score <= 3 ? 'empathetic' : 'helpful',
      suggestedAction: sentiment.requiresEscalation ? 'escalate' : 'reply',
      confidence: 0.85,
    };
  }

  // Fallback
  return {
    message: `Hey! Got your message. Let me look into this and get back to you shortly.`,
    tone: 'helpful',
    confidence: 0.5,
  };
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
            model: { provider: 'openai', model: 'gpt-4o', systemPrompt: `You are calling ${customerName} about: ${issueSummary}. Be apologetic and helpful.` },
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
