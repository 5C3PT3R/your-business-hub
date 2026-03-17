/**
 * REGENT: Knight Discord Bot
 *
 * Receives Discord interactions (slash commands + messages) and pipes them
 * through Knight's RAG-backed support pipeline.
 *
 * Setup:
 *   1. Create a Discord Application at https://discord.com/developers/applications
 *   2. Add a Bot, enable Message Content Intent
 *   3. Under Interactions Endpoint URL → set to this function's URL
 *   4. Add slash command: /support (description: "Get support from Knight")
 *   5. Add secrets: DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN
 *
 * POST /functions/v1/knight-discord
 * Discord sends: { type, data, channel_id, member, user }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   DISCORD_PUBLIC_KEY  (from Application → General Information)
 *   DISCORD_BOT_TOKEN   (from Application → Bot → Token)
 *   KNIGHT_WORKSPACE_ID (default workspace for Discord — set in Dashboard)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const DISCORD_PUBLIC_KEY  = Deno.env.get('DISCORD_PUBLIC_KEY')!;
const DISCORD_BOT_TOKEN   = Deno.env.get('DISCORD_BOT_TOKEN')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KNIGHT_WORKSPACE_ID  = Deno.env.get('KNIGHT_WORKSPACE_ID') ?? '';

// Discord Interaction Types
const PING              = 1;
const APPLICATION_CMD   = 2;

// Discord Interaction Response Types
const PONG              = 1;
const CHANNEL_MSG_SRC   = 4;  // immediate response with message
const DEFERRED_MSG_SRC  = 5;  // "thinking..." — follow up with PATCH

// ─── Ed25519 signature verification ──────────────────────────────────────────
// Discord requires every webhook call to be verified with your app's public key.
async function verifyDiscordRequest(
  req: Request,
  body: string,
): Promise<boolean> {
  if (!DISCORD_PUBLIC_KEY) return false;

  const signature = req.headers.get('x-signature-ed25519');
  const timestamp  = req.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) return false;

  try {
    const publicKeyBytes = hexToUint8Array(DISCORD_PUBLIC_KEY);
    const sigBytes        = hexToUint8Array(signature);
    const msgBytes        = new TextEncoder().encode(timestamp + body);

    const key = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify('Ed25519', key, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ─── Pipe through Knight's support pipeline ───────────────────────────────────
async function getKnightResponse(
  message: string,
  userHandle: string,
  workspaceId: string,
  supabase: any,
): Promise<string> {
  // Reuse knight-webhook's internal logic via internal call
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/knight-webhook/social`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':        SUPABASE_SERVICE_KEY,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        platform:    'discord',
        user_handle: userHandle,
        content:     message,
        workspace_id: workspaceId,
      }),
    });

    const data = await res.json();

    if (data.response) return data.response;
    return "I currently do not have access to that information. Please contact our support team directly.";
  } catch (err) {
    console.error('[Knight Discord] Pipeline error:', err);
    return "I'm having trouble processing your request right now. Please try again shortly.";
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Step 1: Verify Discord signature
  const isValid = await verifyDiscordRequest(req, rawBody);
  if (!isValid) {
    return new Response('Unauthorized — invalid Discord signature', { status: 401 });
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Step 2: Respond to Discord's PING (required for endpoint verification)
  if (interaction.type === PING) {
    return new Response(JSON.stringify({ type: PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 3: Handle /support slash command
  if (interaction.type === APPLICATION_CMD) {
    const commandName = interaction.data?.name;

    if (commandName === 'support') {
      const userMessage = interaction.data?.options?.[0]?.value as string ?? '';
      const userId      = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
      const username    = interaction.member?.user?.username ?? interaction.user?.username ?? 'Discord User';
      const userHandle  = `${username}#${userId}`;

      if (!userMessage.trim()) {
        return new Response(
          JSON.stringify({
            type: CHANNEL_MSG_SRC,
            data: { content: 'Please provide a message. Usage: `/support your question here`' },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Respond with DEFERRED first (gives us time to call Knight pipeline)
      // Then follow up with PATCH to the interaction webhook
      const interactionToken = interaction.token;
      const appId            = interaction.application_id;

      // Fire-and-forget: send deferred response immediately, process async
      (async () => {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const reply    = await getKnightResponse(userMessage, userHandle, KNIGHT_WORKSPACE_ID, supabase);

        // Edit the deferred message with the actual response
        await fetch(
          `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            },
            body: JSON.stringify({ content: reply }),
          },
        );
      })();

      // Return deferred response immediately (Discord requires < 3s)
      return new Response(
        JSON.stringify({ type: DEFERRED_MSG_SRC }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Unknown command
    return new Response(
      JSON.stringify({
        type: CHANNEL_MSG_SRC,
        data: { content: 'Unknown command.' },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ error: 'Unhandled interaction type' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
});
