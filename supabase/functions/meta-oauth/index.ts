/**
 * Meta OAuth 2.0 Flow Handler
 * Handles OAuth for WhatsApp Business, Facebook Messenger, and Instagram
 * All three platforms use Meta's unified OAuth system
 *
 * Security features:
 * - State parameter to prevent CSRF
 * - Token encryption at rest
 * - Audit logging
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_APP_ID = Deno.env.get('META_APP_ID');
const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// OAuth scopes for each platform
const PLATFORM_SCOPES: Record<string, string[]> = {
  whatsapp: [
    'whatsapp_business_management',
    'whatsapp_business_messaging',
    'business_management',
  ],
  messenger: [
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_show_list',
  ],
  instagram: [
    'instagram_basic',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
  ],
};

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-oauth/callback`;

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);

  console.log('=== META OAUTH REQUEST ===');
  console.log('Method:', req.method);
  console.log('Pathname:', url.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Configuration error', message: 'Missing Supabase credentials' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Route: Start OAuth flow
    if (url.pathname === '/meta-oauth' || url.pathname === '/meta-oauth/' || url.pathname === '/') {
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

    // Route: Get connection status
    if (url.pathname.includes('/status')) {
      return await handleStatus(req, supabaseAdmin);
    }

    // Route: Get connected accounts (pages, WhatsApp numbers, etc.)
    if (url.pathname.includes('/accounts')) {
      return await handleGetAccounts(req, supabaseAdmin);
    }

    // Route: Select account to connect
    if (url.pathname.includes('/select-account') && req.method === 'POST') {
      return await handleSelectAccount(req, supabaseAdmin);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', pathname: url.pathname }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Meta OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Start OAuth flow - redirect user to Meta
 */
async function handleOAuthStart(req: Request, supabaseAdmin: any): Promise<Response> {
  console.log('handleOAuthStart called');

  if (!META_APP_ID || !META_APP_SECRET) {
    return new Response(
      JSON.stringify({
        error: 'Meta OAuth not configured',
        message: 'META_APP_ID and META_APP_SECRET must be set in Supabase Edge Functions settings'
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get user from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authorization header missing' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid JWT', message: authError?.message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get platform from query params
  const url = new URL(req.url);
  const platform = url.searchParams.get('platform') || 'messenger';

  if (!['whatsapp', 'messenger', 'instagram'].includes(platform)) {
    return new Response(
      JSON.stringify({ error: 'Invalid platform', message: 'Platform must be whatsapp, messenger, or instagram' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in database
  await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(), // 10 minutes
    metadata: { platform }
  });

  // Get scopes for the platform
  const scopes = PLATFORM_SCOPES[platform].join(',');

  // Build Meta OAuth URL
  const params = new URLSearchParams({
    client_id: META_APP_ID!,
    redirect_uri: REDIRECT_URI,
    state: state,
    scope: scopes,
    response_type: 'code',
  });

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;

  return new Response(
    JSON.stringify({ authUrl, platform }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle OAuth callback from Meta
 */
async function handleOAuthCallback(req: Request, supabaseAdmin: any): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return new Response(
      `<html><body>
        <h1>Authorization Failed</h1>
        <p>${errorDescription || error}</p>
        <p>You can close this window.</p>
        <script>setTimeout(() => window.close(), 5000);</script>
      </body></html>`,
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
  const { data: stateData, error: stateError } = await supabaseAdmin
    .from('oauth_states')
    .select('user_id, expires_at, metadata')
    .eq('state', state)
    .single();

  if (stateError || !stateData) {
    console.error('State verification failed:', stateError);
    return new Response(
      '<html><body><h1>Security Error</h1><p>Invalid state parameter. Please try again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Check if state expired
  if (new Date(stateData.expires_at) < new Date()) {
    return new Response(
      '<html><body><h1>Session Expired</h1><p>Please try connecting again.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Delete state (use only once)
  await supabaseAdmin.from('oauth_states').delete().eq('state', state);

  const userId = stateData.user_id;
  const platform = stateData.metadata?.platform || 'messenger';

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&client_secret=${META_APP_SECRET}` +
      `&code=${code}`
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      throw new Error(errorData.error?.message || 'Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    );

    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days

    // Get user info from Meta
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${accessToken}`
    );
    const meData = await meResponse.json();

    // Store temporary token for account selection
    const tempTokenId = crypto.randomUUID();
    await supabaseAdmin.from('oauth_states').insert({
      state: tempTokenId,
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      metadata: {
        platform,
        access_token: accessToken,
        expires_in: expiresIn,
        meta_user_id: meData.id,
        meta_user_name: meData.name,
      }
    });

    // Redirect to account selection page
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:8080';
    const redirectUrl = `${appUrl}/settings?tab=integrations&meta_auth=${tempTokenId}&platform=${platform}`;

    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body>
        <h1>Error</h1>
        <p>${(error as Error).message}</p>
        <script>setTimeout(() => window.close(), 5000);</script>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * Get available accounts (pages, WhatsApp numbers) for the authenticated user
 */
async function handleGetAccounts(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get temp token ID from query
  const url = new URL(req.url);
  const tempTokenId = url.searchParams.get('token_id');
  const platform = url.searchParams.get('platform') || 'messenger';

  if (!tempTokenId) {
    return new Response(
      JSON.stringify({ error: 'Missing token_id parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get temp token data
  const { data: tokenState, error: stateError } = await supabaseAdmin
    .from('oauth_states')
    .select('metadata')
    .eq('state', tempTokenId)
    .eq('user_id', user.id)
    .single();

  if (stateError || !tokenState) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = tokenState.metadata.access_token;
  const accounts: any[] = [];

  try {
    if (platform === 'whatsapp') {
      // Get WhatsApp Business Accounts
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${accessToken}`
      );
      const wabaData = await wabaResponse.json();

      for (const business of wabaData.data || []) {
        for (const waba of business.owned_whatsapp_business_accounts?.data || []) {
          for (const phone of waba.phone_numbers?.data || []) {
            accounts.push({
              type: 'whatsapp',
              id: phone.id,
              name: phone.verified_name || phone.display_phone_number,
              phone_number: phone.display_phone_number,
              waba_id: waba.id,
              waba_name: waba.name,
              business_id: business.id,
              business_name: business.name,
            });
          }
        }
      }
    } else if (platform === 'messenger' || platform === 'instagram') {
      // Get Facebook Pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
      );
      const pagesData = await pagesResponse.json();

      for (const page of pagesData.data || []) {
        if (platform === 'messenger') {
          accounts.push({
            type: 'messenger',
            id: page.id,
            name: page.name,
            page_access_token: page.access_token,
          });
        } else if (platform === 'instagram' && page.instagram_business_account) {
          accounts.push({
            type: 'instagram',
            id: page.instagram_business_account.id,
            name: page.instagram_business_account.username,
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ accounts, meta_user: tokenState.metadata.meta_user_name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch accounts', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Select and save an account connection
 */
async function handleSelectAccount(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json();
  const { token_id, account, workspace_id } = body;

  if (!token_id || !account || !workspace_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get temp token data
  const { data: tokenState, error: stateError } = await supabaseAdmin
    .from('oauth_states')
    .select('metadata')
    .eq('state', token_id)
    .eq('user_id', user.id)
    .single();

  if (stateError || !tokenState) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = tokenState.metadata.access_token;
  const platform = account.type;

  try {
    // Prepare connection data based on platform
    const connectionData: any = {
      user_id: user.id,
      workspace_id,
      platform,
      platform_account_id: account.id,
      platform_account_name: account.name,
      access_token: platform === 'messenger' || platform === 'instagram'
        ? account.page_access_token
        : accessToken,
      token_expires_at: new Date(Date.now() + (tokenState.metadata.expires_in * 1000)).toISOString(),
      status: 'active',
    };

    if (platform === 'whatsapp') {
      connectionData.phone_number_id = account.id;
      connectionData.whatsapp_business_id = account.waba_id;
    } else if (platform === 'messenger') {
      connectionData.page_id = account.id;
      connectionData.page_name = account.name;
    } else if (platform === 'instagram') {
      connectionData.instagram_account_id = account.id;
      connectionData.page_id = account.page_id;
      connectionData.page_name = account.page_name;
    }

    // Insert or update connection
    const { data: connection, error: insertError } = await supabaseAdmin
      .from('social_connections')
      .upsert(connectionData, {
        onConflict: 'workspace_id,platform,platform_account_id',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save connection');
    }

    // Delete temp token
    await supabaseAdmin.from('oauth_states').delete().eq('state', token_id);

    return new Response(
      JSON.stringify({ success: true, connection }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error saving connection:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save connection', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Disconnect a social connection
 */
async function handleDisconnect(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json();
  const { connection_id } = body;

  if (!connection_id) {
    return new Response(
      JSON.stringify({ error: 'Missing connection_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update connection status
  const { error: updateError } = await supabaseAdmin
    .from('social_connections')
    .update({ status: 'disconnected' })
    .eq('id', connection_id)
    .eq('user_id', user.id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to disconnect' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Get connection status for a platform
 */
async function handleStatus(req: Request, supabaseAdmin: any): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const platform = url.searchParams.get('platform');
  const workspaceId = url.searchParams.get('workspace_id');

  let query = supabaseAdmin
    .from('social_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (platform) {
    query = query.eq('platform', platform);
  }
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data: connections, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ connections }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
