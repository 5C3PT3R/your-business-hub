/**
 * Microsoft Outlook OAuth 2.0 Flow Handler
 * Handles OAuth for Microsoft Graph API (Mail + Calendar)
 *
 * Required Azure AD App Registration:
 * - Redirect URI: {SUPABASE_URL}/functions/v1/outlook-oauth/callback
 * - API Permissions: Mail.Read, Mail.Send, Calendars.Read, User.Read
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptToken } from '../_shared/encryption.ts';
import { enforceRateLimit } from '../_shared/rate-limiter.ts';
import { logAudit, logOAuthConnected } from '../_shared/audit-logger.ts';

const OUTLOOK_CLIENT_ID = Deno.env.get('OUTLOOK_CLIENT_ID');
const OUTLOOK_CLIENT_SECRET = Deno.env.get('OUTLOOK_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Microsoft Graph API scopes
const OUTLOOK_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Mail.Read',
  'Mail.Send',
  'Calendars.Read',
  'User.Read',
].join(' ');

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/outlook-oauth/callback`;
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0';

serve(async (req) => {
  const url = new URL(req.url);

  console.log('=== Outlook OAuth Request ===');
  console.log('Method:', req.method);
  console.log('Pathname:', url.pathname);

  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://hireregent.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Configuration error', message: 'Missing Supabase credentials' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Route: Start OAuth flow
    if (url.pathname === '/outlook-oauth' || url.pathname === '/outlook-oauth/' || url.pathname === '/') {
      return await handleOAuthStart(req, supabaseAdmin);
    }

    // Route: OAuth callback
    if (url.pathname.includes('/callback')) {
      return await handleOAuthCallback(req, supabaseAdmin);
    }

    // Route: Disconnect
    if (url.pathname.includes('/disconnect') && req.method === 'POST') {
      return await handleDisconnect(req, supabaseAdmin);
    }

    // Route: Status
    if (url.pathname.includes('/status') && req.method === 'GET') {
      return await handleStatus(req, supabaseAdmin);
    }

    // Route: Refresh token
    if (url.pathname.includes('/refresh') && req.method === 'POST') {
      return await handleRefreshToken(req, supabaseAdmin);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' },
    });
  } catch (error) {
    console.error('Outlook OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }
});

/**
 * Start OAuth flow - redirect user to Microsoft
 */
async function handleOAuthStart(req: Request, supabaseAdmin: any): Promise<Response> {
  if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        error: 'Outlook OAuth not configured',
        message: 'OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET must be set',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authorization header missing' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid JWT', message: authError?.message }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
    );
  }

  // Rate limiting
  try {
    const rateLimitResponse = await enforceRateLimit(supabaseAdmin, user.id, 'outlook-oauth');
    if (rateLimitResponse) return rateLimitResponse;
  } catch (e) {
    console.warn('Rate limiting skipped:', e);
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in database
  await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(),
  });

  // Build Microsoft OAuth URL
  const params = new URLSearchParams({
    client_id: OUTLOOK_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: OUTLOOK_SCOPES,
    state: state,
    response_mode: 'query',
    prompt: 'consent',
  });

  const authUrl = `${MICROSOFT_AUTH_URL}/authorize?${params.toString()}`;

  return new Response(JSON.stringify({ authUrl }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' },
  });
}

/**
 * Handle OAuth callback from Microsoft
 */
async function handleOAuthCallback(req: Request, supabase: any): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return new Response(
      `<html><body><h1>Authorization Failed</h1><p>${error}: ${errorDescription}</p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new Response(
      '<html><body><h1>Invalid Request</h1><p>Missing code or state parameter.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Verify state parameter
  const { data: stateData, error: stateError } = await supabase
    .from('oauth_states')
    .select('user_id, expires_at')
    .eq('state', state)
    .single();

  if (stateError || !stateData) {
    return new Response(
      '<html><body><h1>Security Error</h1><p>Invalid state parameter.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Check expiry
  if (new Date(stateData.expires_at) < new Date()) {
    return new Response(
      '<html><body><h1>Session Expired</h1><p>Please try again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Delete state
  await supabase.from('oauth_states').delete().eq('state', state);

  const userId = stateData.user_id;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(`${MICROSOFT_AUTH_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OUTLOOK_CLIENT_ID!,
        client_secret: OUTLOOK_CLIENT_SECRET!,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: OUTLOOK_SCOPES,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.mail || userInfo.userPrincipalName;

    // Encrypt tokens
    const { encryptedToken: encryptedAccess, iv: accessIv } = await encryptToken(tokens.access_token);
    const { encryptedToken: encryptedRefresh, iv: refreshIv } = await encryptToken(tokens.refresh_token);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Ensure user profile exists
    await supabase.from('profiles').upsert({
      id: userId,
      email: emailAddress,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false });

    // Store tokens
    const { error: dbError } = await supabase.from('oauth_tokens').upsert({
      user_id: userId,
      channel: 'outlook',
      encrypted_access_token: encryptedAccess,
      encrypted_refresh_token: encryptedRefresh,
      token_iv: accessIv,
      refresh_token_iv: refreshIv,
      expires_at: expiresAt.toISOString(),
      scopes: tokens.scope.split(' '),
      email_address: emailAddress,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,channel' });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store tokens');
    }

    // Audit log
    await logOAuthConnected(supabase, userId, 'outlook', emailAddress, tokens.scope.split(' '));

    return new Response(
      `<html>
        <head><title>Connected</title></head>
        <body>
          <h1>✅ Outlook Connected Successfully!</h1>
          <p>Email: <strong>${emailAddress}</strong></p>
          <p>You can close this window now.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${(error as Error).message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Refresh access token
 */
async function handleRefreshToken(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  // Get stored refresh token
  const { data: tokenData } = await supabaseAdmin
    .from('oauth_tokens')
    .select('encrypted_refresh_token, refresh_token_iv')
    .eq('user_id', user.id)
    .eq('channel', 'outlook')
    .single();

  if (!tokenData) {
    return new Response(JSON.stringify({ error: 'No Outlook connection found' }), { status: 404 });
  }

  // TODO: Decrypt refresh token and get new access token
  // For now, return placeholder
  return new Response(
    JSON.stringify({ success: true, message: 'Token refresh not yet implemented' }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
  );
}

/**
 * Disconnect Outlook
 */
async function handleDisconnect(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  await supabaseAdmin
    .from('oauth_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('channel', 'outlook');

  await logAudit(supabaseAdmin, {
    action: 'oauth_disconnected',
    entityType: 'oauth_token',
    userId: user.id,
    performedBy: 'user',
    metadata: { channel: 'outlook' },
    riskLevel: 'low',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Outlook disconnected' }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
  );
}

/**
 * Get connection status
 */
async function handleStatus(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  const { data: tokenData } = await supabaseAdmin
    .from('oauth_tokens')
    .select('email_address, scopes, created_at, last_synced_at')
    .eq('user_id', user.id)
    .eq('channel', 'outlook')
    .single();

  return new Response(
    JSON.stringify({
      connected: !!tokenData,
      email: tokenData?.email_address,
      scopes: tokenData?.scopes,
      connectedAt: tokenData?.created_at,
      lastSyncedAt: tokenData?.last_synced_at,
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hireregent.com' } }
  );
}
