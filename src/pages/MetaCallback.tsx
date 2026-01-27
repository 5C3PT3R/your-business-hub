/**
 * Meta OAuth Callback Handler
 *
 * This page handles the redirect from Meta OAuth flow.
 * It exchanges the authorization code for an access token and saves the integration.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getMetaUser,
  getUserPages,
  saveMetaIntegration,
  saveMetaPages,
} from '@/lib/meta-service';

export default function MetaCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();
  const { toast } = useToast();
  const hasRun = useRef(false);

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Meta authorization...');

  // Wait for auth to load before processing callback
  useEffect(() => {
    // Don't run if already ran or still loading
    if (hasRun.current || authLoading || workspaceLoading) return;

    // Mark as run to prevent double execution
    hasRun.current = true;
    handleCallback();
  }, [authLoading, workspaceLoading, user, workspace]);

  const handleCallback = async () => {
    console.log('[MetaCallback] Starting callback handler...');
    console.log('[MetaCallback] Current URL:', window.location.href);

    // Use URLSearchParams directly from window.location to avoid React Router timing issues
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    console.log('[MetaCallback] URL params:', { code: code ? 'present' : 'missing', error, errorDescription });

    // Check for errors
    if (error) {
      console.log('[MetaCallback] OAuth error from Facebook:', error, errorDescription);
      setStatus('error');
      setMessage(errorDescription || 'Authorization was denied.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    if (!code) {
      console.log('[MetaCallback] No authorization code in URL');
      setStatus('error');
      setMessage('No authorization code received.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    // Try to get session directly if hooks haven't loaded
    let userId = user?.id;
    let workspaceId = workspace?.id;

    console.log('[MetaCallback] Initial IDs from hooks:', { userId, workspaceId });

    if (!userId || !workspaceId) {
      console.log('[MetaCallback] Falling back to direct session/localStorage...');
      // Fallback: get session directly from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[MetaCallback] Session from Supabase:', session ? 'found' : 'not found');

      if (session?.user?.id) {
        userId = session.user.id;
      }

      // Get workspace ID from localStorage (avoids 406 error on workspaces table)
      if (!workspaceId) {
        const cachedWorkspaceId = localStorage.getItem('workspace_id');
        console.log('[MetaCallback] Workspace from localStorage:', cachedWorkspaceId);
        if (cachedWorkspaceId) {
          workspaceId = cachedWorkspaceId;
        }
      }
    }

    console.log('[MetaCallback] Final IDs:', { userId, workspaceId });

    if (!userId || !workspaceId) {
      console.log('[MetaCallback] Missing user or workspace ID');
      setStatus('error');
      setMessage('User session not found. Please try again.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    // Get stored credentials
    const appId = sessionStorage.getItem('meta_app_id');
    const appSecret = sessionStorage.getItem('meta_app_secret');

    console.log('[MetaCallback] Credentials from sessionStorage:', { appId: appId ? 'present' : 'missing', appSecret: appSecret ? 'present' : 'missing' });

    if (!appId) {
      console.log('[MetaCallback] App ID not found in sessionStorage');
      setStatus('error');
      setMessage('App credentials not found. Please try again.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    try {
      console.log('[MetaCallback] Step 1: Exchanging authorization code...');
      setMessage('Exchanging authorization code...');

      // Exchange code for token
      const redirectUri = `${window.location.origin}/meta/callback`;
      console.log('[MetaCallback] Redirect URI:', redirectUri);

      const tokenData = await exchangeCodeForToken(code, appId, appSecret || '', redirectUri);
      console.log('[MetaCallback] Token exchange result:', tokenData ? 'success' : 'failed');

      if (!tokenData?.access_token) {
        throw new Error('Failed to get access token');
      }

      let accessToken = tokenData.access_token;
      let expiresAt: Date | undefined;

      // Try to get long-lived token if we have the app secret
      if (appSecret) {
        console.log('[MetaCallback] Step 2: Getting long-lived token...');
        setMessage('Getting long-lived token...');
        const longLivedData = await getLongLivedToken(accessToken, appId, appSecret);
        console.log('[MetaCallback] Long-lived token result:', longLivedData ? 'success' : 'failed');

        if (longLivedData?.access_token) {
          accessToken = longLivedData.access_token;
          // Long-lived tokens expire in ~60 days
          expiresAt = new Date(Date.now() + (longLivedData.expires_in || 60 * 24 * 60 * 60) * 1000);
        }
      }

      console.log('[MetaCallback] Step 3: Fetching user info...');
      setMessage('Fetching user info...');

      // Get user info
      const metaUser = await getMetaUser(accessToken);
      console.log('[MetaCallback] User info result:', metaUser ? metaUser.name : 'failed');

      if (!metaUser) {
        throw new Error('Failed to get user info');
      }

      console.log('[MetaCallback] Step 4: Saving integration...');
      setMessage('Saving integration...');

      // Save integration
      const integration = await saveMetaIntegration(userId, workspaceId, {
        app_id: appId,
        access_token: accessToken,
        token_expires_at: expiresAt,
        facebook_user_id: metaUser.id,
        facebook_user_name: metaUser.name,
      });
      console.log('[MetaCallback] Save integration result:', integration ? 'success' : 'failed');

      if (!integration) {
        throw new Error('Failed to save integration');
      }

      console.log('[MetaCallback] Step 5: Fetching connected pages...');
      setMessage('Fetching connected pages...');

      // Get and save pages
      const pages = await getUserPages(accessToken);
      console.log('[MetaCallback] Pages found:', pages.length);

      if (pages.length > 0) {
        console.log('[MetaCallback] Saving pages...');
        await saveMetaPages(integration.id, userId, pages);
      }

      // Clean up session storage
      sessionStorage.removeItem('meta_app_id');
      sessionStorage.removeItem('meta_app_secret');

      console.log('[MetaCallback] SUCCESS! Connected as:', metaUser.name);
      setStatus('success');
      setMessage(`Connected as ${metaUser.name}! Found ${pages.length} page(s).`);

      toast({
        title: 'Meta Connected!',
        description: `Successfully connected ${pages.length} page(s).`,
      });

      setTimeout(() => navigate('/integrations/meta'), 2000);
    } catch (error) {
      console.error('[MetaCallback] ERROR:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An error occurred');

      toast({
        title: 'Connection Failed',
        description: 'Could not connect to Meta. Please try again.',
        variant: 'destructive',
      });

      setTimeout(() => navigate('/integrations/meta'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
        )}
        {status === 'success' && (
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        )}
        {status === 'error' && (
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        )}

        <h2 className="text-xl font-semibold">
          {status === 'processing' && 'Connecting to Meta...'}
          {status === 'success' && 'Connected!'}
          {status === 'error' && 'Connection Failed'}
        </h2>

        <p className="text-muted-foreground max-w-md">{message}</p>

        {status !== 'processing' && (
          <p className="text-sm text-muted-foreground">
            Redirecting...
          </p>
        )}
      </div>
    </div>
  );
}
