/**
 * DAY 7: Bishop Production Trigger
 *
 * Admin component to manually trigger Bishop sweep in production.
 * Calls the Supabase Edge Function bishop-sweep.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bot, Play, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface SweepResult {
  success: boolean;
  message: string;
  leads_processed: number;
  drafts_created: number;
  results?: Array<{ lead: string; strategy: string; success: boolean }>;
  timestamp: string;
}

export function BishopTrigger() {
  const { user, isSubscribed } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SweepResult | null>(null);

  const handleRunBishop = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to run Bishop.',
        variant: 'destructive',
      });
      return;
    }

    if (!isSubscribed) {
      toast({
        title: 'Subscription required',
        description: 'Subscribe to enable Bishop agent.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('bishop-sweep', {
        body: { user_id: user.id },
      });

      if (error) {
        throw error;
      }

      setLastResult(data as SweepResult);

      toast({
        title: 'Bishop sweep complete',
        description: `Processed ${data.leads_processed} leads, created ${data.drafts_created} drafts.`,
      });
    } catch (error: any) {
      console.error('[BISHOP] Trigger error:', error);

      toast({
        title: 'Bishop sweep failed',
        description: error.message || 'Unknown error occurred',
        variant: 'destructive',
      });

      setLastResult({
        success: false,
        message: error.message || 'Unknown error',
        leads_processed: 0,
        drafts_created: 0,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Bishop Agent
        </CardTitle>
        <CardDescription>
          Run the Bishop sweep to process leads and generate follow-up drafts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleRunBishop}
          disabled={loading || !isSubscribed}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Bishop...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Bishop Sweep
            </>
          )}
        </Button>

        {!isSubscribed && (
          <p className="text-sm text-muted-foreground text-center">
            Subscribe to enable Bishop agent.
          </p>
        )}

        {lastResult && (
          <div className={`p-3 rounded-lg ${lastResult.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`font-medium ${lastResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {lastResult.success ? 'Sweep Complete' : 'Sweep Failed'}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <p>Leads processed: {lastResult.leads_processed}</p>
              <p>Drafts created: {lastResult.drafts_created}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(lastResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
