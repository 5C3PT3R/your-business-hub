// Social Webhook Handler for WhatsApp, Facebook Messenger, and Instagram
// Endpoint: POST /api/webhooks/social

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// Helper to fetch WhatsApp media URL from media ID
async function getWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<{ url: string | null; error?: string }> {
  try {
    // First, get the media URL from the media ID
    const response = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to get media metadata:', errorData);
      return { url: null, error: errorData.error?.message || 'Failed to fetch media' };
    }

    const data = await response.json();

    if (!data.url) {
      return { url: null, error: 'No URL in media response' };
    }

    // The URL from Meta requires the access token to download
    // We need to fetch and re-host or return the URL with instructions
    return { url: data.url };
  } catch (error) {
    console.error('Error fetching media URL:', error);
    return { url: null, error: error.message };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify Meta webhook signature
async function verifyMetaSignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const signatureHash = signature.replace('sha256=', '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computedHash = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === signatureHash;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = Deno.env.get('META_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // Handle incoming webhooks (POST)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.text();
    const signature = req.headers.get('X-Hub-Signature-256') || '';
    const appSecret = Deno.env.get('META_APP_SECRET');

    // Verify signature (optional but recommended)
    if (appSecret && signature) {
      const isValid = await verifyMetaSignature(payload, signature, appSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    }

    const data = JSON.parse(payload);
    const objectType = data.object;

    console.log(`Received ${objectType} webhook:`, JSON.stringify(data, null, 2));

    // Log the raw event for debugging and replay
    await supabaseClient.from('social_webhook_events').insert([{
      platform: objectType === 'whatsapp_business_account' ? 'whatsapp' :
                objectType === 'page' ? 'messenger' :
                objectType === 'instagram' ? 'instagram' : objectType,
      event_type: 'webhook',
      payload: data,
      processed: false,
    }]);

    // Process based on platform
    if (objectType === 'whatsapp_business_account') {
      await processWhatsAppWebhook(supabaseClient, data);
    } else if (objectType === 'page') {
      await processMessengerWebhook(supabaseClient, data);
    } else if (objectType === 'instagram') {
      await processInstagramWebhook(supabaseClient, data);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processWhatsAppWebhook(supabase: any, data: any) {
  for (const entry of data.entry || []) {
    const wabaId = entry.id;
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const contacts = value.contacts || [];
      const messages = value.messages || [];
      const statuses = value.statuses || [];

      // Find the connection for this phone number
      const { data: connection } = await supabase
        .from('social_connections')
        .select('*')
        .eq('platform', 'whatsapp')
        .eq('phone_number_id', phoneNumberId)
        .single();

      if (!connection) {
        console.log('No connection found for phone number:', phoneNumberId);
        continue;
      }

      // Process incoming messages
      for (const message of messages) {
        const contact = contacts.find((c: any) => c.wa_id === message.from);
        const waId = message.from; // Sender's WhatsApp ID (phone number)

        // Find or create conversation
        let { data: conversation } = await supabase
          .from('social_conversations')
          .select('*')
          .eq('connection_id', connection.id)
          .eq('platform_conversation_id', waId)
          .single();

        if (!conversation) {
          // Try to match to existing contact by phone
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('workspace_id', connection.workspace_id)
            .ilike('phone', `%${waId.slice(-10)}%`)
            .limit(1)
            .single();

          const { data: newConv } = await supabase
            .from('social_conversations')
            .insert([{
              workspace_id: connection.workspace_id,
              connection_id: connection.id,
              contact_id: existingContact?.id || null,
              platform: 'whatsapp',
              platform_conversation_id: waId,
              platform_user_id: waId,
              platform_user_name: contact?.profile?.name || waId,
              session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              requires_template: false,
              status: 'active',
            }])
            .select()
            .single();

          conversation = newConv;
        }

        // Determine message type and content
        let messageType = message.type || 'text';
        let body = null;
        let mediaUrl = null;
        let mediaId = null;
        let mediaMimeType = null;
        let caption = null;

        if (message.text) {
          body = message.text.body;
          messageType = 'text';
        } else if (message.image) {
          mediaId = message.image.id;
          mediaMimeType = message.image.mime_type;
          caption = message.image.caption;
          messageType = 'image';
          // Fetch actual media URL
          const mediaResult = await getWhatsAppMediaUrl(mediaId, connection.access_token);
          mediaUrl = mediaResult.url;
        } else if (message.document) {
          mediaId = message.document.id;
          mediaMimeType = message.document.mime_type;
          caption = message.document.caption;
          messageType = 'document';
          const mediaResult = await getWhatsAppMediaUrl(mediaId, connection.access_token);
          mediaUrl = mediaResult.url;
        } else if (message.audio) {
          mediaId = message.audio.id;
          mediaMimeType = message.audio.mime_type;
          messageType = 'audio';
          const mediaResult = await getWhatsAppMediaUrl(mediaId, connection.access_token);
          mediaUrl = mediaResult.url;
        } else if (message.video) {
          mediaId = message.video.id;
          mediaMimeType = message.video.mime_type;
          caption = message.video.caption;
          messageType = 'video';
          const mediaResult = await getWhatsAppMediaUrl(mediaId, connection.access_token);
          mediaUrl = mediaResult.url;
        } else if (message.sticker) {
          mediaId = message.sticker.id;
          mediaMimeType = message.sticker.mime_type;
          messageType = 'sticker';
          const mediaResult = await getWhatsAppMediaUrl(mediaId, connection.access_token);
          mediaUrl = mediaResult.url;
        } else if (message.reaction) {
          messageType = 'reaction';
          body = message.reaction.emoji;
        }

        // Insert the message
        await supabase.from('social_messages').insert([{
          workspace_id: connection.workspace_id,
          conversation_id: conversation.id,
          platform: 'whatsapp',
          external_id: message.id,
          direction: 'inbound',
          message_type: messageType,
          body,
          caption,
          media_url: mediaUrl,
          media_id: mediaId, // Store media ID for potential re-fetch
          media_mime_type: mediaMimeType,
          reaction_emoji: message.reaction?.emoji,
          reply_to_id: message.context?.id,
          status: 'delivered',
          sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        }]);

        // Update conversation counts
        await supabase.rpc('increment_conversation_counts', {
          conv_id: conversation.id,
          is_inbound: true,
        });
      }

      // Process status updates (sent, delivered, read)
      for (const status of statuses) {
        const messageId = status.id;
        const newStatus = status.status; // sent, delivered, read, failed

        await supabase
          .from('social_messages')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            delivered_at: newStatus === 'delivered' ? new Date().toISOString() : undefined,
            read_at: newStatus === 'read' ? new Date().toISOString() : undefined,
            error_code: status.errors?.[0]?.code,
            error_message: status.errors?.[0]?.message,
          })
          .eq('external_id', messageId);
      }
    }
  }
}

async function processMessengerWebhook(supabase: any, data: any) {
  for (const entry of data.entry || []) {
    const pageId = entry.id;
    const messaging = entry.messaging || [];

    // Find the connection for this page
    const { data: connection } = await supabase
      .from('social_connections')
      .select('*')
      .eq('platform', 'messenger')
      .eq('page_id', pageId)
      .single();

    if (!connection) {
      console.log('No connection found for page:', pageId);
      continue;
    }

    for (const event of messaging) {
      const senderId = event.sender?.id;
      const message = event.message;

      if (!message || !senderId) continue;

      // Find or create conversation
      let { data: conversation } = await supabase
        .from('social_conversations')
        .select('*')
        .eq('connection_id', connection.id)
        .eq('platform_conversation_id', senderId)
        .single();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('social_conversations')
          .insert([{
            workspace_id: connection.workspace_id,
            connection_id: connection.id,
            platform: 'messenger',
            platform_conversation_id: senderId,
            platform_user_id: senderId,
            status: 'active',
          }])
          .select()
          .single();

        conversation = newConv;
      }

      // Determine message type
      let messageType = 'text';
      let body = message.text;
      let mediaUrl = null;

      if (message.attachments?.length > 0) {
        const attachment = message.attachments[0];
        messageType = attachment.type; // image, video, audio, file
        mediaUrl = attachment.payload?.url;
      }

      if (message.sticker_id) {
        messageType = 'sticker';
      }

      // Insert message
      await supabase.from('social_messages').insert([{
        workspace_id: connection.workspace_id,
        conversation_id: conversation.id,
        platform: 'messenger',
        external_id: message.mid,
        direction: 'inbound',
        message_type: messageType,
        body,
        media_url: mediaUrl,
        source_page_name: connection.page_name,
        status: 'delivered',
        sent_at: new Date(event.timestamp).toISOString(),
      }]);
    }
  }
}

async function processInstagramWebhook(supabase: any, data: any) {
  for (const entry of data.entry || []) {
    const igId = entry.id;
    const messaging = entry.messaging || [];

    // Find the connection for this Instagram account
    const { data: connection } = await supabase
      .from('social_connections')
      .select('*')
      .eq('platform', 'instagram')
      .eq('instagram_account_id', igId)
      .single();

    if (!connection) {
      console.log('No connection found for Instagram:', igId);
      continue;
    }

    for (const event of messaging) {
      const senderId = event.sender?.id;
      const message = event.message;

      if (!message || !senderId) continue;

      // Find or create conversation
      let { data: conversation } = await supabase
        .from('social_conversations')
        .select('*')
        .eq('connection_id', connection.id)
        .eq('platform_conversation_id', senderId)
        .single();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('social_conversations')
          .insert([{
            workspace_id: connection.workspace_id,
            connection_id: connection.id,
            platform: 'instagram',
            platform_conversation_id: senderId,
            platform_user_id: senderId,
            status: 'active',
          }])
          .select()
          .single();

        conversation = newConv;
      }

      // Determine message type
      let messageType = 'text';
      let body = message.text;
      let mediaUrl = null;

      if (message.attachments?.length > 0) {
        const attachment = message.attachments[0];
        messageType = attachment.type;
        mediaUrl = attachment.payload?.url;
      }

      // Check for story reply
      if (message.reply_to?.story) {
        messageType = 'story_reply';
      }

      // Insert message
      await supabase.from('social_messages').insert([{
        workspace_id: connection.workspace_id,
        conversation_id: conversation.id,
        platform: 'instagram',
        external_id: message.mid,
        direction: 'inbound',
        message_type: messageType,
        body,
        media_url: mediaUrl,
        status: 'delivered',
        sent_at: new Date(event.timestamp).toISOString(),
      }]);
    }
  }
}
