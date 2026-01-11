import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Integration } from '@/types/inbox';
import { getPlatformConfig } from '@/config/platforms';

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIntegrations([]);
        return;
      }

      // Fetch OAuth tokens for connected platforms
      const { data: oauthTokens, error: oauthError } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', session.user.id);

      if (oauthError) {
        throw oauthError;
      }

      // Transform oauth_tokens to Integration format
      const connectedIntegrations: Integration[] = (oauthTokens || []).map((token) => {
        const platformConfig = getPlatformConfig(token.channel);

        return {
          id: token.id,
          userId: token.user_id,
          platform: token.channel as any, // gmail, facebook, instagram
          name: platformConfig?.name || token.channel,
          icon: platformConfig?.icon || '📧',
          color: platformConfig?.color || '#6B7280',
          category: platformConfig?.category || 'email',
          isConnected: true,
          isActive: true,
          unreadCount: 0, // TODO: Fetch actual unread count
          lastSyncAt: token.last_synced_at ? new Date(token.last_synced_at) : undefined,
          credentials: {
            email: token.email_address,
            scopes: token.scopes,
          },
          metadata: token.metadata as Record<string, any>,
          createdAt: new Date(token.created_at),
          updatedAt: new Date(token.updated_at),
        };
      });

      setIntegrations(connectedIntegrations);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch integrations'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshIntegrations() {
    await fetchIntegrations();
  }

  return {
    integrations,
    loading,
    error,
    refreshIntegrations,
  };
}
