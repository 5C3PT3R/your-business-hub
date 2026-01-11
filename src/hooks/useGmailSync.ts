import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useGmailSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  async function syncGmail() {
    try {
      setIsSyncing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the gmail-sync Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync Gmail');
      }

      const result = await response.json();

      toast({
        title: 'Gmail synced successfully',
        description: `Synced ${result.synced} new messages, skipped ${result.skipped} existing messages.`,
      });

      return result;
    } catch (error) {
      console.error('Gmail sync error:', error);
      toast({
        title: 'Gmail sync failed',
        description: error instanceof Error ? error.message : 'Failed to sync Gmail messages',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }

  return {
    syncGmail,
    isSyncing,
  };
}
