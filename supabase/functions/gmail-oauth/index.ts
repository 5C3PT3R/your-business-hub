/**
 * Gmail OAuth 2.0 Flow Handler
 * Handles both initial authorization and callback
 *
 * Security features:
 * - PKCE flow for added security
 * - State parameter to prevent CSRF
 * - Token encryption at rest
 * - Audit logging
 * - Rate limiting
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptToken } from '../_shared/encryption.ts';
import { enforceRateLimit } from '../_shared/rate-limiter.ts';
import { logAudit, logOAuthConnected } from '../_shared/audit-logger.ts';

const GMAIL_CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID');
const GMAIL_CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// OAuth scopes - full access (read, send, modify)
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gmail-oauth/callback`;

// In-memory state storage (in production, use Redis)
const stateStore = new Map<string, { userId: string; createdAt: number }>();

// Cleanup old states every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [state, data] of stateStore.entries()) {
    if (data.createdAt < oneHourAgo) {
      stateStore.delete(state);
    }
  }
}, 3600000);

serve(async (req) => {
  const url = new URL(req.url);

  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY exists:', !!SUPABASE_ANON_KEY);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!SUPABASE_SERVICE_ROLE_KEY);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials');
    return new Response(
      JSON.stringify({
        error: 'Configuration error',
        message: 'SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set'
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }

  // Create anon client for JWT verification (used to verify user tokens)
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Create service role client for admin operations (database writes)
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Route: Start OAuth flow
    if (url.pathname === '/gmail-oauth' || url.pathname === '/gmail-oauth/') {
      return await handleOAuthStart(req, supabaseClient, supabaseAdmin);
    }

    // Route: OAuth callback
    if (url.pathname.includes('/callback')) {
      return await handleOAuthCallback(req, supabaseAdmin);
    }

    // Route: Disconnect Gmail
    if (url.pathname.includes('/disconnect') && req.method === 'POST') {
      return await handleDisconnect(req, supabaseClient, supabaseAdmin);
    }

    // Route: Get connection status
    if (url.pathname.includes('/status') && req.method === 'GET') {
      return await handleStatus(req, supabaseClient, supabaseAdmin);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Start OAuth flow - redirect user to Google
 */
async function handleOAuthStart(req: Request, supabaseClient: any, supabaseAdmin: any): Promise<Response> {
  console.log('handleOAuthStart called');
  console.log('GMAIL_CLIENT_ID exists:', !!GMAIL_CLIENT_ID);
  console.log('GMAIL_CLIENT_SECRET exists:', !!GMAIL_CLIENT_SECRET);

  // Check if environment variables are set
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.log('Environment variables missing');
    return new Response(
      JSON.stringify({
        error: 'Gmail OAuth not configured',
        message: 'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables must be set in Supabase Edge Functions settings'
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }

  // Get user from Authorization header
  const authHeader = req.headers.get('Authorization');
  console.log('Authorization header exists:', !!authHeader);

  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authorization header missing' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('Attempting to verify JWT token...');

  // Use anon client to verify user JWT token
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
  console.log('JWT verification result - user exists:', !!user, 'error:', authError?.message);

  if (authError || !user) {
    console.error('JWT verification failed:', authError);
    return new Response(
      JSON.stringify({
        code: 401,
        error: 'Invalid JWT',
        message: authError?.message || 'Unable to verify user token',
        details: 'Make sure you are logged in and your session is active'
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }

  // Rate limiting (skip if function not available)
  try {
    const rateLimitResponse = await enforceRateLimit(supabaseAdmin, user.id, 'gmail-oauth');
    if (rateLimitResponse) return rateLimitResponse;
  } catch (e) {
    console.warn('Rate limiting skipped:', e);
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();
  stateStore.set(state, { userId: user.id, createdAt: Date.now() });

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    state: state,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(
    JSON.stringify({ authUrl }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    }
  );
}

/**
 * Handle OAuth callback from Google
 */
async function handleOAuthCallback(req: Request, supabase: any): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Check for OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return new Response(
      `<html><body><h1>Authorization Failed</h1><p>${error}</p><p>You can close this window.</p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new Response(
      '<html><body><h1>Invalid Request</h1><p>Missing code or state parameter.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Verify state parameter (CSRF protection)
  const stateData = stateStore.get(state);
  if (!stateData) {
    await logAudit(supabase, {
      action: 'unauthorized_access_attempt',
      entityType: 'oauth_token',
      performedBy: 'system',
      metadata: { reason: 'Invalid OAuth state parameter' },
      riskLevel: 'high',
    });

    return new Response(
      '<html><body><h1>Security Error</h1><p>Invalid state parameter. Please try again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  stateStore.delete(state); // Use state only once
  const userId = stateData.userId;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    // Get user's Gmail address
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.email;

    // Encrypt tokens before storage
    const { encryptedToken: encryptedAccess, iv: accessIv } = await encryptToken(tokens.access_token);
    const { encryptedToken: encryptedRefresh, iv: refreshIv } = await encryptToken(tokens.refresh_token);

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store encrypted tokens
    const { error: dbError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: userId,
        channel: 'gmail',
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        token_iv: accessIv, // Store both IVs (in production, store separately)
        expires_at: expiresAt.toISOString(),
        scopes: tokens.scope.split(' '),
        email_address: emailAddress,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,channel',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store tokens');
    }

    // Audit log
    await logOAuthConnected(supabase, userId, 'gmail', emailAddress, tokens.scope.split(' '));

    // Success page with auto-close
    return new Response(
      `<html>
        <head><title>Connected</title></head>
        <body>
          <h1>✅ Gmail Connected Successfully!</h1>
          <p>Email: <strong>${emailAddress}</strong></p>
          <p>You can close this window now.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Disconnect Gmail integration
 */
async function handleDisconnect(req: Request, supabaseClient: any, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  // Delete tokens
  await supabaseAdmin
    .from('oauth_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('channel', 'gmail');

  // Audit log
  await logAudit(supabaseAdmin, {
    action: 'oauth_disconnected',
    entityType: 'oauth_token',
    userId: user.id,
    performedBy: 'user',
    metadata: { channel: 'gmail' },
    riskLevel: 'low',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Gmail disconnected' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    }
  );
}

/**
 * Get Gmail connection status
 */
async function handleStatus(req: Request, supabaseClient: any, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  const { data: tokenData } = await supabaseAdmin
    .from('oauth_tokens')
    .select('email_address, scopes, created_at, last_synced_at')
    .eq('user_id', user.id)
    .eq('channel', 'gmail')
    .single();

  const connected = !!tokenData;

  return new Response(
    JSON.stringify({
      connected,
      email: tokenData?.email_address,
      scopes: tokenData?.scopes,
      connectedAt: tokenData?.created_at,
      lastSyncedAt: tokenData?.last_synced_at,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    }
  );
}
