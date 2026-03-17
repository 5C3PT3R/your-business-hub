/**
 * REGENT: Knight Telegram Bot
 *
 * Receives Telegram webhook updates and pipes them through Knight's
 * RAG-backed support pipeline. Replies via Telegram Bot API.
 *
 * Setup:
 *   1. Create a bot via @BotFather on Telegram → /newbot
 *   2. Copy the bot token
 *   3. Set webhook: POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *      { url: "https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/knight-telegram" }
 *   4. Add secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN, KNIGHT_WORKSPACE_ID
 *   5. Deploy: supabase functions deploy knight-telegram --no-verify-jwt
 *
 * POST /functions/v1/knight-telegram
 * Telegram sends: { update_id, message: { chat, from, text } }
 *
 * Secrets required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TELEGRAM_BOT_TOKEN     (from @BotFather)
 *   TELEGRAM_SECRET_TOKEN  (set in setWebhook call — verifies calls are from Telegram)
 *   KNIGHT_WORKSPACE_ID    (default workspace for Telegram)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TELEGRAM_BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_SECRET_TOKEN = Deno.env.get('TELEGRAM_SECRET_TOKEN') ?? '';
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KNIGHT_WORKSPACE_ID    = Deno.env.get('KNIGHT_WORKSPACE_ID') ?? '';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ─── Send message via Telegram Bot API ───────────────────────────────────────
async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text,
        parse_mode: 'None', // plain text — consistent with Knight's no-markdown rule
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Knight Telegram] sendMessage error:', err);
    }
  } catch (err) {
    console.error('[Knight Telegram] sendMessage failed:', err);
  }
}

// ─── Pipe through Knight's support pipeline ───────────────────────────────────
async function getKnightResponse(
  message: string,
  userHandle: string,
  workspaceId: string,
): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/knight-webhook/social`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        platform:     'telegram',
        user_handle:  userHandle,
        content:      message,
        workspace_id: workspaceId,
      }),
    });

    const data = await res.json();
    if (data.response) return data.response;
    return "I currently do not have access to that information. Please contact our support team directly.";
  } catch (err) {
    console.error('[Knight Telegram] Pipeline error:', err);
    return "I'm having trouble processing your request right now. Please try again shortly.";
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify Telegram secret token (set during setWebhook call)
  if (TELEGRAM_SECRET_TOKEN) {
    const incomingToken = req.headers.get('x-telegram-bot-api-secret-token');
    if (incomingToken !== TELEGRAM_SECRET_TOKEN) {
      console.warn('[Knight Telegram] Invalid secret token');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Telegram always expects 200 OK immediately — process async
  (async () => {
    const message = update?.message;

    // Only handle text messages
    if (!message?.text) {
      console.log('[Knight Telegram] Ignoring non-text update:', update?.update_id);
      return;
    }

    const chatId    = message.chat.id;
    const text      = message.text.trim();
    const from      = message.from;
    const userId    = from?.id ?? 'unknown';
    const username  = from?.username ?? from?.first_name ?? 'Telegram User';
    const userHandle = `${username}@${userId}`;

    console.log('[Knight Telegram] Message from:', userHandle, '—', text.slice(0, 80));

    // Skip bot commands other than /start and /help
    if (text.startsWith('/')) {
      if (text === '/start') {
        await sendTelegramMessage(chatId,
          "Hi! I'm Knight, your support assistant. Send me your question and I'll do my best to help."
        );
        return;
      }
      if (text === '/help') {
        await sendTelegramMessage(chatId,
          "Just type your question and I'll respond. For urgent issues, our team is also available at hello@hireregent.com."
        );
        return;
      }
      // Other commands — ignore
      return;
    }

    // Send typing action (shows "typing..." to user while we process)
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });

    const reply = await getKnightResponse(text, userHandle, KNIGHT_WORKSPACE_ID);
    await sendTelegramMessage(chatId, reply);
  })();

  // Respond 200 immediately so Telegram doesn't retry
  return new Response('ok', { status: 200 });
});
