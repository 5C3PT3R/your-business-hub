import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export function useGmailSend() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  async function sendEmail({ to, subject, body }: SendEmailParams) {
    try {
      setIsSending(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('[useGmailSend] Sending email...');
      console.log('[useGmailSend] User ID:', session.user.id);
      console.log('[useGmailSend] Email:', session.user.email);

      // First check if Gmail is connected
      const { data: oauthTokens, error: tokenError } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('channel', 'gmail')
        .maybeSingle();

      console.log('[useGmailSend] OAuth check:', { found: !!oauthTokens, error: tokenError });

      if (!oauthTokens) {
        throw new Error('Gmail not connected. Please connect Gmail in Settings > Integrations.');
      }

      // Call the gmail-send Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to, subject, body }),
        }
      );

      console.log('[useGmailSend] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[useGmailSend] API error:', error);
        throw new Error(error.error || error.details || 'Failed to send email');
      }

      const result = await response.json();

      toast({
        title: 'Email sent successfully',
        description: `Your email to ${to} has been sent.`,
      });

      return result;
    } catch (error) {
      console.error('Gmail send error:', error);
      toast({
        title: 'Failed to send email',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsSending(false);
    }
  }

  return {
    sendEmail,
    isSending,
  };
}
