/**
 * Gmail API utilities
 * Token management, message fetching, and sending
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from './encryption.ts';
import { logAudit } from './audit-logger.ts';

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Get valid Gmail access token (refreshes if needed)
 */
export async function getValidGmailToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'gmail')
    .single();

  if (error || !tokenRow) {
    throw new Error('Gmail not connected');
  }

  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date();

  // Refresh if expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 300000) {
    return await refreshGmailToken(supabase, userId, tokenRow);
  }

  // Token still valid
  return await decryptToken(tokenRow.encrypted_access_token, tokenRow.token_iv);
}

/**
 * Refresh Gmail access token
 */
async function refreshGmailToken(
  supabase: SupabaseClient,
  userId: string,
  tokenRow: any
): Promise<string> {
  try {
    const refreshToken = await decryptToken(
      tokenRow.encrypted_refresh_token,
      tokenRow.token_iv
    );

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GMAIL_CLIENT_ID')!,
        client_secret: Deno.env.get('GMAIL_CLIENT_SECRET')!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh failed:', errorData);

      // If refresh token is invalid, user needs to reconnect
      if (errorData.error === 'invalid_grant') {
        await supabase
          .from('oauth_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('channel', 'gmail');

        throw new Error('Gmail token expired - please reconnect');
      }

      throw new Error('Failed to refresh Gmail token');
    }

    const tokens = await response.json();

    // Encrypt new access token
    const { encryptedToken, iv } = await encryptToken(tokens.access_token);

    // Calculate new expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Update database
    await supabase
      .from('oauth_tokens')
      .update({
        encrypted_access_token: encryptedToken,
        token_iv: iv,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('channel', 'gmail');

    // Audit log
    await logAudit(supabase, {
      action: 'oauth_token_refreshed',
      entityType: 'oauth_token',
      userId,
      performedBy: 'system',
      metadata: { channel: 'gmail' },
      riskLevel: 'low',
    });

    return tokens.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Fetch a Gmail message by ID
 */
export async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Gmail message: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailEmail(
  accessToken: string,
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText?: string,
  cc?: string[],
  bcc?: string[],
  threadId?: string
): Promise<string> {
  // Build RFC 2822 email
  let email = [
    `To: ${to}`,
    cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : null,
    bcc && bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText || stripHtml(bodyHtml),
    '',
    '--boundary123',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    bodyHtml,
    '',
    '--boundary123--',
  ]
    .filter(Boolean)
    .join('\r\n');

  // Base64 encode (URL-safe)
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: any = {
    raw: encodedEmail,
  };

  if (threadId) {
    requestBody.threadId = threadId;
  }

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gmail send failed:', errorData);
    throw new Error(`Failed to send email: ${errorData.error?.message || response.statusText}`);
  }

  const result = await response.json();
  return result.id; // Gmail message ID
}

/**
 * Strip HTML tags (simple version)
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Extract email body from Gmail message (handles multipart)
 */
export function extractEmailBody(message: any): { text: string; html?: string } {
  let text = '';
  let html = '';

  function extractParts(parts: any[]): void {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html += decodeBase64(part.body.data);
      } else if (part.parts) {
        extractParts(part.parts);
      }
    }
  }

  if (message.payload.parts) {
    extractParts(message.payload.parts);
  } else if (message.payload.body?.data) {
    // Single part message
    if (message.payload.mimeType === 'text/html') {
      html = decodeBase64(message.payload.body.data);
    } else {
      text = decodeBase64(message.payload.body.data);
    }
  }

  return {
    text: text || (html ? stripHtml(html) : ''),
    html: html || undefined,
  };
}

/**
 * Decode base64url (Gmail format)
 */
function decodeBase64(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(base64)));
}

/**
 * Get header value from Gmail message
 */
export function getHeader(message: any, headerName: string): string | null {
  const headers = message.payload?.headers || [];
  const header = headers.find(
    (h: any) => h.name.toLowerCase() === headerName.toLowerCase()
  );
  return header?.value || null;
}

/**
 * Clean email body (remove signatures, quoted replies)
 */
export function cleanEmailBody(body: string): string {
  // Remove quoted replies (lines starting with >)
  let cleaned = body
    .split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n');

  // Remove common signature separators
  const signatureSeparators = [
    /\n--\s*\n/,
    /\n---\s*\n/,
    /\nSent from my iPhone/i,
    /\nSent from my Android/i,
    /\nGet Outlook for iOS/i,
    /\nThanks,?\s*\n/i,
    /\nBest regards,?\s*\n/i,
    /\nRegards,?\s*\n/i,
  ];

  for (const separator of signatureSeparators) {
    const match = cleaned.match(separator);
    if (match && match.index !== undefined) {
      cleaned = cleaned.substring(0, match.index);
    }
  }

  return cleaned.trim();
}
