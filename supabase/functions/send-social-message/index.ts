import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  connectionId: string;
  conversationId?: string;
  recipientId: string; // Phone number for WhatsApp, PSID for Messenger, IGSID for Instagram
  messageType: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio';
  content: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  mediaUrl?: string;
  caption?: string;
}

interface WhatsAppMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: string;
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>;
  };
  image?: { link: string; caption?: string };
  document?: { link: string; caption?: string; filename?: string };
  video?: { link: string; caption?: string };
  audio?: { link: string };
}

interface MessengerMessagePayload {
  recipient: { id: string };
  message: {
    text?: string;
    attachment?: {
      type: string;
      payload: { url: string; is_reusable?: boolean };
    };
  };
  messaging_type: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
}

interface InstagramMessagePayload {
  recipient: { id: string };
  message: {
    text?: string;
    attachment?: {
      type: string;
      payload: { url: string };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SendMessageRequest = await req.json();
    const { connectionId, conversationId, recipientId, messageType, content, templateName, templateLanguage, templateVariables, mediaUrl, caption } = body;

    // Validate required fields
    if (!connectionId || !recipientId || !messageType) {
      return new Response(JSON.stringify({ error: 'Missing required fields: connectionId, recipientId, messageType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (messageType === 'text' && !content) {
      return new Response(JSON.stringify({ error: 'Text message requires content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (messageType === 'template' && (!templateName || !templateLanguage)) {
      return new Response(JSON.stringify({ error: 'Template message requires templateName and templateLanguage' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('status', 'active')
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response: Response;
    let messageId: string | null = null;
    let apiResponse: any;

    // Send message based on platform
    switch (connection.platform) {
      case 'whatsapp':
        const waResult = await sendWhatsAppMessage(
          connection.phone_number_id,
          connection.access_token,
          recipientId,
          messageType,
          content,
          templateName,
          templateLanguage,
          templateVariables,
          mediaUrl,
          caption
        );
        apiResponse = waResult;
        messageId = waResult.messages?.[0]?.id || null;
        break;

      case 'messenger':
        const fbResult = await sendMessengerMessage(
          connection.page_id,
          connection.access_token,
          recipientId,
          messageType,
          content,
          mediaUrl
        );
        apiResponse = fbResult;
        messageId = fbResult.message_id || null;
        break;

      case 'instagram':
        const igResult = await sendInstagramMessage(
          connection.instagram_account_id,
          connection.access_token,
          recipientId,
          messageType,
          content,
          mediaUrl
        );
        apiResponse = igResult;
        messageId = igResult.message_id || null;
        break;

      default:
        return new Response(JSON.stringify({ error: `Unsupported platform: ${connection.platform}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Check for API errors
    if (apiResponse.error) {
      console.error('Social API error:', apiResponse.error);

      // Store failed message
      await supabase.from('social_messages').insert({
        conversation_id: conversationId,
        platform: connection.platform,
        direction: 'outbound',
        message_type: messageType,
        content: messageType === 'template' ? `Template: ${templateName}` : content,
        status: 'failed',
        error_code: apiResponse.error.code?.toString(),
        error_message: apiResponse.error.message,
        metadata: { templateName, templateVariables, mediaUrl },
      });

      return new Response(JSON.stringify({
        error: 'Failed to send message',
        details: apiResponse.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create conversation
    let finalConversationId = conversationId;
    if (!finalConversationId) {
      // Try to find existing conversation
      const { data: existingConv } = await supabase
        .from('social_conversations')
        .select('id')
        .eq('connection_id', connectionId)
        .eq('platform_conversation_id', recipientId)
        .single();

      if (existingConv) {
        finalConversationId = existingConv.id;
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from('social_conversations')
          .insert({
            workspace_id: connection.workspace_id,
            connection_id: connectionId,
            platform: connection.platform,
            platform_conversation_id: recipientId,
            participant_name: recipientId, // Will be updated when we receive a response
            participant_id: recipientId,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!convError && newConv) {
          finalConversationId = newConv.id;
        }
      }
    }

    // Store sent message
    const { data: savedMessage, error: msgError } = await supabase
      .from('social_messages')
      .insert({
        conversation_id: finalConversationId,
        platform: connection.platform,
        platform_message_id: messageId,
        direction: 'outbound',
        message_type: messageType,
        content: messageType === 'template' ? `Template: ${templateName}` : content,
        media_url: mediaUrl,
        status: 'sent',
        metadata: { templateName, templateLanguage, templateVariables, caption },
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) {
      console.error('Failed to save message:', msgError);
    }

    // Update conversation last_message_at
    if (finalConversationId) {
      await supabase
        .from('social_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageType === 'template' ? `Template: ${templateName}` : content?.substring(0, 100),
        })
        .eq('id', finalConversationId);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId,
      conversationId: finalConversationId,
      message: savedMessage,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send message error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  messageType: string,
  content: string,
  templateName?: string,
  templateLanguage?: string,
  templateVariables?: Record<string, string>,
  mediaUrl?: string,
  caption?: string
): Promise<any> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  let payload: WhatsAppMessagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone.replace(/\D/g, ''), // Remove non-digits
    type: messageType === 'template' ? 'template' : messageType,
  };

  switch (messageType) {
    case 'text':
      payload.text = { body: content };
      break;

    case 'template':
      payload.template = {
        name: templateName!,
        language: { code: templateLanguage! },
      };
      // Add template variables if provided
      if (templateVariables && Object.keys(templateVariables).length > 0) {
        const parameters = Object.values(templateVariables).map(value => ({
          type: 'text',
          text: value,
        }));
        payload.template.components = [
          { type: 'body', parameters },
        ];
      }
      break;

    case 'image':
      payload.type = 'image';
      payload.image = { link: mediaUrl!, caption };
      break;

    case 'document':
      payload.type = 'document';
      payload.document = { link: mediaUrl!, caption };
      break;

    case 'video':
      payload.type = 'video';
      payload.video = { link: mediaUrl!, caption };
      break;

    case 'audio':
      payload.type = 'audio';
      payload.audio = { link: mediaUrl! };
      break;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

async function sendMessengerMessage(
  pageId: string,
  accessToken: string,
  recipientPsid: string,
  messageType: string,
  content: string,
  mediaUrl?: string
): Promise<any> {
  const url = `https://graph.facebook.com/v18.0/${pageId}/messages`;

  let payload: MessengerMessagePayload = {
    recipient: { id: recipientPsid },
    messaging_type: 'RESPONSE',
    message: {},
  };

  if (messageType === 'text') {
    payload.message.text = content;
  } else if (['image', 'video', 'audio', 'file'].includes(messageType)) {
    payload.message.attachment = {
      type: messageType === 'file' ? 'file' : messageType,
      payload: { url: mediaUrl!, is_reusable: true },
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

async function sendInstagramMessage(
  igAccountId: string,
  accessToken: string,
  recipientIgsid: string,
  messageType: string,
  content: string,
  mediaUrl?: string
): Promise<any> {
  // Instagram uses the same Send API as Messenger
  const url = `https://graph.facebook.com/v18.0/${igAccountId}/messages`;

  let payload: InstagramMessagePayload = {
    recipient: { id: recipientIgsid },
    message: {},
  };

  if (messageType === 'text') {
    payload.message.text = content;
  } else if (['image', 'video'].includes(messageType)) {
    payload.message.attachment = {
      type: messageType,
      payload: { url: mediaUrl! },
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Helper to fetch WhatsApp media URL from media ID
export async function getWhatsAppMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Failed to fetch media URL:', error);
    return null;
  }
}
