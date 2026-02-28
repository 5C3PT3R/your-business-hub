// Token Refresh Function for Social Connections
// Should be called via cron job or manually to refresh expiring tokens

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshResult {
  connectionId: string;
  platform: string;
  success: boolean;
  error?: string;
  newExpiresAt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');

    if (!metaAppId || !metaAppSecret) {
      return new Response(JSON.stringify({ error: 'Missing Meta app credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find connections that expire within the next 7 days
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() + 7);

    const { data: expiringConnections, error: fetchError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('status', 'active')
      .in('platform', ['whatsapp', 'messenger', 'instagram'])
      .lt('token_expires_at', expirationThreshold.toISOString())
      .not('access_token', 'is', null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${expiringConnections?.length || 0} connections to refresh`);

    const results: RefreshResult[] = [];

    for (const connection of expiringConnections || []) {
      const result = await refreshMetaToken(
        connection,
        metaAppId,
        metaAppSecret,
        supabase
      );
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function refreshMetaToken(
  connection: any,
  appId: string,
  appSecret: string,
  supabase: any
): Promise<RefreshResult> {
  const { id, platform, access_token } = connection;

  try {
    // Meta tokens can be refreshed by exchanging them for long-lived tokens again
    // This extends the token's validity by another 60 days
    const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', access_token);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Token refresh failed');
    }

    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 5184000; // Default to 60 days
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Update the connection with new token
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        access_token: newAccessToken,
        token_expires_at: newExpiresAt.toISOString(),
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Successfully refreshed token for ${platform} connection ${id}`);

    return {
      connectionId: id,
      platform,
      success: true,
      newExpiresAt: newExpiresAt.toISOString(),
    };

  } catch (error) {
    console.error(`Failed to refresh token for ${id}:`, error);

    // Update connection with error status
    await supabase
      .from('social_connections')
      .update({
        last_error: error.message,
        status: error.message.includes('expired') ? 'expired' : 'error',
      })
      .eq('id', id);

    return {
      connectionId: id,
      platform,
      success: false,
      error: error.message,
    };
  }
}
