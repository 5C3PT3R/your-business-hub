/**
 * Meta Integration Settings Page
 *
 * Connect and manage Facebook, Instagram, WhatsApp, and Ads Manager integrations.
 */

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Facebook,
  Instagram,
  MessageCircle,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Unplug,
  Settings,
  Users,
  FileText,
  DollarSign,
  Phone,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Megaphone,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getMetaOAuthUrl,
  getMetaIntegration,
  saveMetaIntegration,
  disconnectMetaIntegration,
  getMetaPages,
  getMetaWhatsAppAccounts,
  syncWhatsAppAccounts,
  MetaIntegration,
  MetaPage,
  MetaWhatsAppAccount,
} from '@/lib/meta-service';

// Environment variables (should be in .env)
const META_REDIRECT_URI = `${window.location.origin}/meta/callback`;

export default function MetaIntegrationPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  // State
  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState<MetaWhatsAppAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Setup Dialog - auto-populate from env vars if available
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [appId, setAppId] = useState(import.meta.env.VITE_META_APP_ID || '');
  const [appSecret, setAppSecret] = useState(import.meta.env.VITE_META_APP_SECRET || '');
  const [showSecret, setShowSecret] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(['pages', 'leads', 'ads'])
  );

  // Load integration data
  useEffect(() => {
    if (workspace?.id) {
      loadIntegration();
    }
  }, [workspace?.id]);

  const loadIntegration = async () => {
    if (!workspace?.id) return;

    setIsLoading(true);
    try {
      const data = await getMetaIntegration(workspace.id);
      setIntegration(data);

      if (data?.id) {
        // Load pages and WhatsApp accounts in parallel
        const [pagesData, whatsappData] = await Promise.all([
          getMetaPages(data.id),
          getMetaWhatsAppAccounts(data.id),
        ]);
        setPages(pagesData);
        setWhatsappAccounts(whatsappData);
      }
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth connect
  const handleConnect = () => {
    if (!appId) {
      toast({
        title: 'App ID Required',
        description: 'Please enter your Meta App ID.',
        variant: 'destructive',
      });
      return;
    }

    // Store app credentials temporarily
    sessionStorage.setItem('meta_app_id', appId);
    sessionStorage.setItem('meta_app_secret', appSecret);

    // Generate OAuth URL and redirect
    const features = Array.from(selectedFeatures) as any;
    const oauthUrl = getMetaOAuthUrl(appId, META_REDIRECT_URI, features);

    window.location.href = oauthUrl;
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!workspace?.id) return;

    const success = await disconnectMetaIntegration(workspace.id);
    if (success) {
      setIntegration(null);
      setPages([]);
      setWhatsappAccounts([]);
      toast({
        title: 'Disconnected',
        description: 'Meta integration has been disconnected.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to disconnect. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle sync
  const handleSync = async () => {
    if (!integration?.id || !user?.id || !integration.access_token) {
      toast({
        title: 'Sync Failed',
        description: 'Missing integration data. Please reconnect.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      // Sync WhatsApp accounts from Meta API
      const syncedWhatsApp = await syncWhatsAppAccounts(
        integration.id,
        user.id,
        integration.access_token
      );

      if (syncedWhatsApp.length > 0) {
        setWhatsappAccounts(syncedWhatsApp);
      }

      // Reload all data
      await loadIntegration();

      toast({
        title: 'Sync Complete',
        description: `Synced ${pages.length} pages and ${syncedWhatsApp.length} WhatsApp accounts.`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync Meta data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle feature selection
  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(feature)) {
        next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard.`,
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <Header
          title="Meta Integration"
          subtitle="Facebook, Instagram, WhatsApp & Ads"
          icon={<Facebook className="h-6 w-6 text-blue-600" />}
        />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="Meta Integration"
        subtitle="Facebook, Instagram, WhatsApp & Ads"
        icon={<Facebook className="h-6 w-6 text-blue-600" />}
      />

      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Facebook className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle>Meta Business Suite</CardTitle>
                  <CardDescription>
                    Connect your Facebook, Instagram, and WhatsApp accounts
                  </CardDescription>
                </div>
              </div>

              {integration?.is_connected ? (
                <Badge className="bg-emerald-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {integration?.is_connected ? (
              <div className="space-y-4">
                {/* Connected User */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {integration.facebook_user_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{integration.facebook_user_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Facebook User ID: {integration.facebook_user_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Sync</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                          <Unplug className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Meta?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will disconnect your Facebook, Instagram, and WhatsApp accounts.
                            You'll need to reconnect to sync leads and post content.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDisconnect}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Last Synced */}
                {integration.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(integration.last_synced_at).toLocaleString()}
                  </p>
                )}

                {/* Token Expiry Warning */}
                {integration.token_expires_at && new Date(integration.token_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Your access token expires {new Date(integration.token_expires_at).toLocaleDateString()}.
                      Reconnect to refresh.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Connect your Meta Business account to:
                </p>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  <li className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Capture Facebook Lead Ads
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    Send WhatsApp messages
                  </li>
                  <li className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Post to Instagram
                  </li>
                  <li className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-purple-500" />
                    Manage Facebook Ads
                  </li>
                </ul>

                <Button onClick={() => setShowSetupDialog(true)} className="mt-4">
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Meta Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Pages & Assets */}
        {integration?.is_connected && (
          <Tabs defaultValue="pages" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pages" className="gap-2">
                <Facebook className="h-4 w-4" />
                Pages
                {pages.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pages.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-2">
                <FileText className="h-4 w-4" />
                Lead Forms
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="ads" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Ads
              </TabsTrigger>
            </TabsList>

            {/* Pages Tab */}
            <TabsContent value="pages">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Connected Pages</CardTitle>
                  <CardDescription>
                    Facebook Pages and Instagram accounts you can manage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Facebook className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>No pages connected yet</p>
                      <p className="text-sm">Click Sync to fetch your pages</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pages.map(page => (
                        <div
                          key={page.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={page.page_picture_url || undefined} />
                              <AvatarFallback>{page.page_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{page.page_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{page.page_category}</span>
                                {page.instagram_username && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Instagram className="h-3 w-3" />
                                      @{page.instagram_username}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {page.has_posting_access && (
                              <Badge variant="secondary" className="text-xs">Posting</Badge>
                            )}
                            {page.has_lead_access && (
                              <Badge variant="secondary" className="text-xs">Leads</Badge>
                            )}
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Lead Forms Tab */}
            <TabsContent value="leads">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lead Ad Forms</CardTitle>
                  <CardDescription>
                    Automatically capture leads from your Facebook Lead Ads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No lead forms synced yet</p>
                    <p className="text-sm">Select a page and sync to see lead forms</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* WhatsApp Tab */}
            <TabsContent value="whatsapp">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">WhatsApp Business</CardTitle>
                      <CardDescription>
                        Send messages to leads via WhatsApp Business API
                      </CardDescription>
                    </div>
                    {whatsappAccounts.length > 0 && (
                      <Badge className="bg-emerald-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {whatsappAccounts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>WhatsApp not configured</p>
                      <p className="text-sm mb-4">Click Sync to fetch your WhatsApp Business accounts</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync WhatsApp Accounts
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {whatsappAccounts.map(account => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                              <Phone className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">{account.verified_name || account.waba_name || 'WhatsApp Account'}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{account.display_phone_number}</span>
                                {account.quality_rating && (
                                  <>
                                    <span>•</span>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        'text-xs',
                                        account.quality_rating === 'GREEN' && 'bg-green-500/10 text-green-600',
                                        account.quality_rating === 'YELLOW' && 'bg-yellow-500/10 text-yellow-600',
                                        account.quality_rating === 'RED' && 'bg-red-500/10 text-red-600'
                                      )}
                                    >
                                      {account.quality_rating}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {account.messaging_limit && (
                              <Badge variant="secondary" className="text-xs">
                                {account.messaging_limit.replace('TIER_', '')} msgs/day
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                              Active
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Ads Tab */}
            <TabsContent value="ads">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ad Accounts</CardTitle>
                  <CardDescription>
                    View and manage your Meta Ads campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No ad accounts synced</p>
                    <p className="text-sm">Click Sync to fetch your ad accounts</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">
                  1
                </div>
                <div>
                  <p className="font-medium">Create a Meta App</p>
                  <p className="text-sm text-muted-foreground">
                    Go to{' '}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      developers.facebook.com
                    </a>
                    {' '}and create a new Business app.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">
                  2
                </div>
                <div>
                  <p className="font-medium">Add Products</p>
                  <p className="text-sm text-muted-foreground">
                    Enable Facebook Login, Marketing API, and WhatsApp Business API in your app.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">
                  3
                </div>
                <div>
                  <p className="font-medium">Configure OAuth Redirect</p>
                  <p className="text-sm text-muted-foreground">
                    Add this redirect URI to your app settings:
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="px-2 py-1 bg-muted rounded text-xs">
                      {META_REDIRECT_URI}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(META_REDIRECT_URI, 'Redirect URI')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">
                  4
                </div>
                <div>
                  <p className="font-medium">Connect Your Account</p>
                  <p className="text-sm text-muted-foreground">
                    Enter your App ID and App Secret, then click Connect.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Meta Account</DialogTitle>
            <DialogDescription>
              Enter your Meta App credentials to connect Facebook, Instagram, and WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Show notice if credentials are from env vars */}
            {import.meta.env.VITE_META_APP_ID && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Credentials loaded from environment variables</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>App ID *</Label>
              <Input
                placeholder="Enter your Meta App ID"
                value={appId}
                onChange={e => setAppId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>App Secret</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Enter your Meta App Secret"
                  value={appSecret}
                  onChange={e => setAppSecret(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional but recommended for long-lived tokens
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Features to Enable</Label>

              <div className="space-y-2">
                <div
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedFeatures.has('pages') && 'border-blue-500 bg-blue-500/5'
                  )}
                  onClick={() => toggleFeature('pages')}
                >
                  <div className="flex items-center gap-3">
                    <Facebook className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Pages & Instagram</p>
                      <p className="text-xs text-muted-foreground">Post content to your pages</p>
                    </div>
                  </div>
                  <Switch checked={selectedFeatures.has('pages')} />
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedFeatures.has('leads') && 'border-blue-500 bg-blue-500/5'
                  )}
                  onClick={() => toggleFeature('leads')}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-sm">Lead Ads</p>
                      <p className="text-xs text-muted-foreground">Capture leads from Facebook forms</p>
                    </div>
                  </div>
                  <Switch checked={selectedFeatures.has('leads')} />
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedFeatures.has('whatsapp') && 'border-blue-500 bg-blue-500/5'
                  )}
                  onClick={() => toggleFeature('whatsapp')}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">WhatsApp Business</p>
                      <p className="text-xs text-muted-foreground">Send WhatsApp messages</p>
                    </div>
                  </div>
                  <Switch checked={selectedFeatures.has('whatsapp')} />
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedFeatures.has('ads') && 'border-blue-500 bg-blue-500/5'
                  )}
                  onClick={() => toggleFeature('ads')}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-sm">Ads Manager</p>
                      <p className="text-xs text-muted-foreground">Manage ad campaigns</p>
                    </div>
                  </div>
                  <Switch checked={selectedFeatures.has('ads')} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!appId}>
              <Facebook className="h-4 w-4 mr-2" />
              Connect with Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
