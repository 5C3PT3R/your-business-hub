import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageCircle,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  // Using these despite deprecation warnings - they still work
  Facebook,
  Instagram,
  Linkedin,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

type SocialPlatform = 'whatsapp' | 'messenger' | 'instagram' | 'linkedin';

interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  platform_account_name: string;
  status: string;
  created_at: string;
  last_sync_at?: string;
}

interface MetaAccount {
  type: SocialPlatform;
  id: string;
  name: string;
  phone_number?: string;
  waba_id?: string;
  page_id?: string;
  page_name?: string;
  page_access_token?: string;
}

interface IntegrationCardProps {
  platform: SocialPlatform;
  name: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  docsUrl?: string;
  connections: SocialConnection[];
  onConnect: (platform: SocialPlatform) => void;
  onDisconnect: (connectionId: string) => void;
  connecting: boolean;
}

function IntegrationCard({
  platform,
  name,
  description,
  icon,
  bgColor,
  docsUrl,
  connections,
  onConnect,
  onDisconnect,
  connecting,
}: IntegrationCardProps) {
  const platformConnections = connections.filter(c => c.platform === platform);
  const isConnected = platformConnections.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              {isConnected ? (
                <Badge variant="default" className="mt-1">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected ({platformConnections.length})
                </Badge>
              ) : (
                <Badge variant="secondary" className="mt-1">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <CardDescription className="text-xs mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            {platformConnections.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div className="text-sm">
                  <p className="font-medium">{conn.platform_account_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(conn.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDisconnect(conn.id)}
                >
                  Disconnect
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConnect(platform)}
              disabled={connecting || platform === 'linkedin'}
              className="w-full"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Add Another Account
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => onConnect(platform)}
            disabled={connecting || platform === 'linkedin'}
            className="w-full"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : platform === 'linkedin' ? (
              'Coming Soon'
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SocialIntegrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<MetaAccount[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [metaAuthToken, setMetaAuthToken] = useState<string | null>(null);
  const [metaUserName, setMetaUserName] = useState<string>('');
  const [selectingAccount, setSelectingAccount] = useState(false);

  // Fetch existing connections
  useEffect(() => {
    fetchConnections();
  }, [workspace?.id]);

  // Handle OAuth callback
  useEffect(() => {
    const authToken = searchParams.get('meta_auth');
    const platform = searchParams.get('platform') as SocialPlatform;

    if (authToken && platform) {
      setMetaAuthToken(authToken);
      setSelectedPlatform(platform);
      fetchAvailableAccounts(authToken, platform);

      // Clean up URL params
      searchParams.delete('meta_auth');
      searchParams.delete('platform');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  async function fetchConnections() {
    if (!workspace?.id) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth/status?workspace_id=${workspace.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableAccounts(tokenId: string, platform: SocialPlatform) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth/accounts?token_id=${tokenId}&platform=${platform}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableAccounts(data.accounts || []);
        setMetaUserName(data.meta_user || '');
        setShowAccountSelector(true);
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to fetch accounts',
          description: error.message || 'Could not retrieve your accounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch available accounts',
        variant: 'destructive',
      });
    }
  }

  async function handleConnect(platform: SocialPlatform) {
    if (platform === 'linkedin') {
      toast({
        title: 'Coming Soon',
        description: 'LinkedIn integration is under development.',
      });
      return;
    }

    // Redirect to Meta Integration page for all Meta platforms
    // (WhatsApp, Messenger, Instagram all use Meta OAuth)
    navigate('/integrations/meta');
  }

  async function handleSelectAccount(account: MetaAccount) {
    if (!metaAuthToken || !workspace?.id) return;

    try {
      setSelectingAccount(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth/select-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token_id: metaAuthToken,
            account,
            workspace_id: workspace.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save connection');
      }

      toast({
        title: 'Connected successfully',
        description: `${account.name} has been connected.`,
      });

      setShowAccountSelector(false);
      setAvailableAccounts([]);
      setMetaAuthToken(null);
      fetchConnections();

    } catch (error) {
      console.error('Failed to select account:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to save connection',
        variant: 'destructive',
      });
    } finally {
      setSelectingAccount(false);
    }
  }

  async function handleDisconnect(connectionId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth/disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connection_id: connectionId }),
        }
      );

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'Account has been disconnected.',
        });
        fetchConnections();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect failed',
        description: 'Failed to disconnect account',
        variant: 'destructive',
      });
    }
  }

  const integrations = [
    {
      platform: 'whatsapp' as SocialPlatform,
      name: 'WhatsApp Business',
      description: 'Receive and send WhatsApp messages via Cloud API. Includes template support for 24h+ conversations.',
      icon: <MessageCircle className="w-5 h-5 text-green-600" />,
      bgColor: 'bg-green-100',
      docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    },
    {
      platform: 'messenger' as SocialPlatform,
      name: 'Facebook Messenger',
      description: 'Connect your Facebook Page to receive Messenger conversations in your inbox.',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      bgColor: 'bg-blue-100',
      docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    },
    {
      platform: 'instagram' as SocialPlatform,
      name: 'Instagram Direct',
      description: 'Receive Instagram DMs and story replies from your business/creator account.',
      icon: <Instagram className="w-5 h-5 text-pink-600" />,
      bgColor: 'bg-pink-100',
      docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    },
    {
      platform: 'linkedin' as SocialPlatform,
      name: 'LinkedIn Messages',
      description: 'Connect LinkedIn to capture and respond to connection messages (Coming Soon).',
      icon: <Linkedin className="w-5 h-5 text-blue-700" />,
      bgColor: 'bg-blue-100',
      docsUrl: 'https://docs.microsoft.com/linkedin/',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">Social Messaging</h4>
          <p className="text-sm text-muted-foreground">Loading connections...</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">Social Messaging</h4>
          <p className="text-sm text-muted-foreground">
            Connect your social messaging accounts to receive all conversations in one inbox.
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg text-sm mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Meta Business Account Required
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                WhatsApp, Messenger, and Instagram require a Meta Business account with API access configured.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.platform}
              {...integration}
              connections={connections}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              connecting={connecting && selectedPlatform === integration.platform}
            />
          ))}
        </div>
      </div>

      {/* Account Selection Dialog */}
      <Dialog open={showAccountSelector} onOpenChange={setShowAccountSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Account</DialogTitle>
            <DialogDescription>
              {metaUserName && `Logged in as ${metaUserName}. `}
              Choose which account to connect.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableAccounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>No accounts found for this platform.</p>
                <p className="text-xs mt-1">
                  Make sure you have the required permissions and accounts set up.
                </p>
              </div>
            ) : (
              availableAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleSelectAccount(account)}
                  disabled={selectingAccount}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="font-medium">{account.name}</p>
                    {account.phone_number && (
                      <p className="text-xs text-muted-foreground">{account.phone_number}</p>
                    )}
                    {account.page_name && account.type === 'instagram' && (
                      <p className="text-xs text-muted-foreground">via {account.page_name}</p>
                    )}
                  </div>
                  {selectingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountSelector(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
