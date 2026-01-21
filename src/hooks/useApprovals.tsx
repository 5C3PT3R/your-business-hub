/**
 * Hook for managing AI email approvals queue
 * Fetches pending approvals and handles approve/reject/edit actions
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited' | 'sent' | 'failed';
export type RejectionCategory = 'tone' | 'content' | 'timing' | 'strategy' | 'personalization' | 'other';

export interface EmailApproval {
  id: string;
  user_id: string;
  workspace_id: string | null;
  agent_id: string | null;
  agent_name: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  body_html: string | null;
  context: string | null;
  contact_id: string | null;
  deal_id: string | null;
  status: ApprovalStatus;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  sent_at: string | null;
  rejection_reason: string | null;
  rejection_category: RejectionCategory | null;
  edited_subject: string | null;
  edited_body: string | null;
  edited_by: string | null;
  send_via: 'gmail' | 'outlook';
  metadata: Record<string, any>;
  updated_at: string;
  // Joined relations
  contact?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  deal?: {
    id: string;
    title: string;
    company: string | null;
  } | null;
}

interface UseApprovalsReturn {
  approvals: EmailApproval[];
  loading: boolean;
  error: string | null;
  pendingCount: number;
  refreshApprovals: () => Promise<void>;
  approveEmail: (id: string) => Promise<boolean>;
  approveAndSend: (id: string) => Promise<boolean>;
  rejectEmail: (id: string, reason: string, category: RejectionCategory, details?: string) => Promise<boolean>;
  editAndApprove: (id: string, editedSubject: string, editedBody: string) => Promise<boolean>;
}

export function useApprovals(): UseApprovalsReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<EmailApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use 'any' to bypass TypeScript checking for ungenerated types
  const db = supabase as any;

  const fetchApprovals = useCallback(async () => {
    if (!user) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await db
        .from('email_approvals')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email),
          deal:deals(id, title, company)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // If table doesn't exist yet, return empty array (dev mode)
        if (fetchError.code === '42P01') {
          console.warn('email_approvals table not found - run migrations');
          setApprovals([]);
        } else {
          throw fetchError;
        }
      } else {
        setApprovals(data || []);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch approvals');
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [user, db]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = db
      .channel('email_approvals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_approvals',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchApprovals();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [user, db, fetchApprovals]);

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  const approveEmail = async (id: string): Promise<boolean> => {
    try {
      const { error: updateError } = await db
        .from('email_approvals')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'approved' as ApprovalStatus, approved_at: new Date().toISOString() }
            : a
        )
      );

      return true;
    } catch (err) {
      console.error('Error approving email:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve email',
        variant: 'destructive',
      });
      return false;
    }
  };

  const approveAndSend = async (id: string): Promise<boolean> => {
    const approval = approvals.find((a) => a.id === id);
    if (!approval) return false;

    try {
      // First approve
      const { error: updateError } = await db
        .from('email_approvals')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      // Get session for auth
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      // Send via appropriate channel
      const sendEndpoint = approval.send_via === 'outlook'
        ? 'outlook-send'
        : 'gmail-send';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${sendEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: approval.to_email,
            subject: approval.edited_subject || approval.subject,
            body: approval.edited_body || approval.body,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      // Update status to sent
      await db
        .from('email_approvals')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', id);

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'sent' as ApprovalStatus, sent_at: new Date().toISOString() }
            : a
        )
      );

      toast({
        title: 'Email Sent',
        description: `Email to ${approval.to_name || approval.to_email} has been sent.`,
      });

      return true;
    } catch (err) {
      console.error('Error sending email:', err);

      // Mark as failed
      await db
        .from('email_approvals')
        .update({
          status: 'failed',
          metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
        })
        .eq('id', id);

      toast({
        title: 'Send Failed',
        description: err instanceof Error ? err.message : 'Failed to send email',
        variant: 'destructive',
      });

      return false;
    }
  };

  const rejectEmail = async (
    id: string,
    reason: string,
    category: RejectionCategory,
    details?: string
  ): Promise<boolean> => {
    try {
      const fullReason = details ? `${reason}: ${details}` : reason;

      const { error: updateError } = await db
        .from('email_approvals')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: fullReason,
          rejection_category: category,
        })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'rejected' as ApprovalStatus,
                rejected_at: new Date().toISOString(),
                rejection_reason: fullReason,
                rejection_category: category,
              }
            : a
        )
      );

      toast({
        title: 'Email Rejected',
        description: 'Feedback recorded for AI improvement.',
      });

      return true;
    } catch (err) {
      console.error('Error rejecting email:', err);
      toast({
        title: 'Error',
        description: 'Failed to reject email',
        variant: 'destructive',
      });
      return false;
    }
  };

  const editAndApprove = async (
    id: string,
    editedSubject: string,
    editedBody: string
  ): Promise<boolean> => {
    const approval = approvals.find((a) => a.id === id);
    if (!approval) return false;

    try {
      // Update with edited content
      const { error: updateError } = await db
        .from('email_approvals')
        .update({
          status: 'edited',
          approved_at: new Date().toISOString(),
          edited_subject: editedSubject,
          edited_body: editedBody,
          edited_by: user?.id,
        })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      // Get session for auth
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      // Send edited email
      const sendEndpoint = approval.send_via === 'outlook'
        ? 'outlook-send'
        : 'gmail-send';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${sendEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: approval.to_email,
            subject: editedSubject,
            body: editedBody,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      // Update status to sent
      await db
        .from('email_approvals')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', id);

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'sent' as ApprovalStatus,
                edited_subject: editedSubject,
                edited_body: editedBody,
                sent_at: new Date().toISOString(),
              }
            : a
        )
      );

      toast({
        title: 'Edited Email Sent',
        description: `Email to ${approval.to_name || approval.to_email} has been sent.`,
      });

      return true;
    } catch (err) {
      console.error('Error sending edited email:', err);
      toast({
        title: 'Send Failed',
        description: err instanceof Error ? err.message : 'Failed to send email',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    approvals,
    loading,
    error,
    pendingCount,
    refreshApprovals: fetchApprovals,
    approveEmail,
    approveAndSend,
    rejectEmail,
    editAndApprove,
  };
}
