import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GmailStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  connectedAt?: string;
  lastSyncedAt?: string;
}

export function GmailConnect() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth/status`,
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
      console.error('Failed to check Gmail status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setConnecting(true);

      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session ? 'exists' : 'null');

      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to connect Gmail',
          variant: 'destructive',
        });
        return;
      }

      // Get OAuth URL from Edge Function
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth`;
      console.log('Calling Edge Function:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', errorText);
        throw new Error(`Failed to initiate OAuth flow: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('OAuth response:', data);

      const { authUrl } = data;

      if (!authUrl) {
        throw new Error('No authUrl received from Edge Function');
      }

      console.log('Opening OAuth popup:', authUrl);

      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'Gmail OAuth',
        'width=600,height=700,left=200,top=100'
      );

      if (!popup) {
        throw new Error('Failed to open popup. Please allow popups for this site.');
      }

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          console.log('Popup closed, checking connection status...');
          // Check if connection was successful
          setTimeout(() => {
            checkConnectionStatus();
          }, 1000);
        }
      }, 500);
    } catch (error) {
      console.error('Gmail connection error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect Gmail. Please try again.',
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth/disconnect`,
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
          description: 'Gmail has been disconnected successfully',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect failed',
        description: 'Failed to disconnect Gmail',
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail
          </CardTitle>
          <CardDescription>Connect your Gmail account for automatic lead capture</CardDescription>
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
            <Mail className="w-5 h-5" />
            <CardTitle>Gmail</CardTitle>
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
          Automatically capture leads from Gmail conversations
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
                  <p className="font-medium">What happens next?</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>New emails are automatically captured</li>
                    <li>Leads are created from new senders</li>
                    <li>AI analyzes conversations for intent</li>
                    <li>Follow-up tasks are suggested</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="w-full"
            >
              Disconnect Gmail
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Connect your Gmail account to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Automatically capture leads from email conversations</li>
                <li>Track all customer interactions in one place</li>
                <li>Get AI-powered insights and follow-up suggestions</li>
                <li>Never miss a lead or follow-up again</li>
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
                    We only read emails. We never send emails without your explicit approval.
                    All data is encrypted.
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
                  Connect Gmail
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
