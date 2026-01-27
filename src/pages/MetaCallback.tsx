/**
 * Meta OAuth Callback Handler
 *
 * This page handles the redirect from Meta OAuth flow.
 * It exchanges the authorization code for an access token and saves the integration.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
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
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Meta authorization...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for errors
    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'Authorization was denied.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    if (!user?.id || !workspace?.id) {
      setStatus('error');
      setMessage('User session not found. Please try again.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    // Get stored credentials
    const appId = sessionStorage.getItem('meta_app_id');
    const appSecret = sessionStorage.getItem('meta_app_secret');

    if (!appId) {
      setStatus('error');
      setMessage('App credentials not found. Please try again.');
      setTimeout(() => navigate('/integrations/meta'), 3000);
      return;
    }

    try {
      setMessage('Exchanging authorization code...');

      // Exchange code for token
      const redirectUri = `${window.location.origin}/meta/callback`;
      const tokenData = await exchangeCodeForToken(code, appId, appSecret || '', redirectUri);

      if (!tokenData?.access_token) {
        throw new Error('Failed to get access token');
      }

      let accessToken = tokenData.access_token;
      let expiresAt: Date | undefined;

      // Try to get long-lived token if we have the app secret
      if (appSecret) {
        setMessage('Getting long-lived token...');
        const longLivedData = await getLongLivedToken(accessToken, appId, appSecret);

        if (longLivedData?.access_token) {
          accessToken = longLivedData.access_token;
          // Long-lived tokens expire in ~60 days
          expiresAt = new Date(Date.now() + (longLivedData.expires_in || 60 * 24 * 60 * 60) * 1000);
        }
      }

      setMessage('Fetching user info...');

      // Get user info
      const metaUser = await getMetaUser(accessToken);

      if (!metaUser) {
        throw new Error('Failed to get user info');
      }

      setMessage('Saving integration...');

      // Save integration
      const integration = await saveMetaIntegration(user.id, workspace.id, {
        app_id: appId,
        access_token: accessToken,
        token_expires_at: expiresAt,
        facebook_user_id: metaUser.id,
        facebook_user_name: metaUser.name,
      });

      if (!integration) {
        throw new Error('Failed to save integration');
      }

      setMessage('Fetching connected pages...');

      // Get and save pages
      const pages = await getUserPages(accessToken);

      if (pages.length > 0) {
        await saveMetaPages(integration.id, user.id, pages);
      }

      // Clean up session storage
      sessionStorage.removeItem('meta_app_id');
      sessionStorage.removeItem('meta_app_secret');

      setStatus('success');
      setMessage(`Connected as ${metaUser.name}! Found ${pages.length} page(s).`);

      toast({
        title: 'Meta Connected!',
        description: `Successfully connected ${pages.length} page(s).`,
      });

      setTimeout(() => navigate('/integrations/meta'), 2000);
    } catch (error) {
      console.error('Meta callback error:', error);
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
