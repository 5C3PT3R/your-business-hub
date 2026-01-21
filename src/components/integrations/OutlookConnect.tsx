/**
 * Outlook Connection Component
 * OAuth integration for Microsoft 365 (Mail + Calendar)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Loader2, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OutlookStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  connectedAt?: string;
  lastSyncedAt?: string;
}

export function OutlookConnect() {
  const [status, setStatus] = useState<OutlookStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  async function checkConnectionStatus() {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus({ connected: false });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-oauth/status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check Outlook status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setConnecting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to connect Outlook',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-oauth`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to initiate OAuth: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const { authUrl } = data;

      if (!authUrl) {
        throw new Error('No authUrl received');
      }

      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'Outlook OAuth',
        'width=600,height=700,left=200,top=100'
      );

      if (!popup) {
        throw new Error('Failed to open popup. Please allow popups for this site.');
      }

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setTimeout(() => {
            checkConnectionStatus();
          }, 1000);
        }
      }, 500);
    } catch (error) {
      console.error('Outlook connection error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect Outlook',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-oauth/disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        setStatus({ connected: false });
        toast({
          title: 'Disconnected',
          description: 'Outlook has been disconnected successfully',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect failed',
        description: 'Failed to disconnect Outlook',
        variant: 'destructive',
      });
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-sync/sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Sync complete',
          description: `Synced ${result.syncedCount} emails`,
        });
        checkConnectionStatus();
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Failed to sync emails',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Microsoft Outlook
          </CardTitle>
          <CardDescription>Connect your Outlook account for email and calendar sync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <CardTitle>Microsoft Outlook</CardTitle>
            {status.connected ? (
              <Badge variant="default" className="ml-2">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">
                <XCircle className="w-3 h-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Sync emails and calendar events from Microsoft 365
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.connected ? (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{status.email}</span>
              </div>
              {status.connectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected:</span>
                  <span className="font-medium">
                    {new Date(status.connectedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {status.lastSyncedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last synced:</span>
                  <span className="font-medium">
                    {new Date(status.lastSyncedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">Connected Features:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email sync (read & send)
                    </li>
                    <li className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Calendar events
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
                className="flex-1"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Sync Now'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="flex-1"
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Connect your Microsoft 365 account to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Sync emails from Outlook inbox</li>
                <li>Send emails directly from the CRM</li>
                <li>View calendar events and meeting schedules</li>
                <li>Track email interactions with contacts</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Secure & Private
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    We use OAuth 2.0 for secure authentication. Your password is never shared with us.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Connect Outlook
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
