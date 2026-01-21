import { supabase } from '@/integrations/supabase/client';

export interface Draft {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  subject: string;
  body: string;
  plain_text: string | null;
  persona_used: string;
  is_ai_draft: boolean;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'ARCHIVED';
  created_at: string;
  metadata: Record<string, any> | null;
}

// Simplified interface for UI display
export interface DraftDisplayInfo {
  id: string;
  lead_name: string | null;
  company: string | null;
  title: string | null;
  confidence: number | null;
  context: string | null;
  email_subject: string | null;
  email_body: string | null;
  target_email: string | null; // Email address of the lead/contact
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

// Response from send-email edge function
export interface SendEmailResponse {
  success?: boolean;
  message?: string;
  recipient?: string;
  timestamp?: string;
  error?: string;
  details?: string;
}

/**
 * Fetches all pending drafts from the ai_drafts table
 * @returns Promise<DraftDisplayInfo[]> - Array of pending drafts, ordered by created_at descending
 */
export async function fetchPendingDrafts(): Promise<DraftDisplayInfo[]> {
  try {
    // Use type assertion to bypass TypeScript checking since ai_drafts is not in the Database type
    // Query ai_drafts and join with contacts/leads for display info (including email)
    const { data, error } = await (supabase as any)
      .from('ai_drafts')
      .select(`
        *,
        contacts:contact_id (
          name,
          company,
          email
        ),
        leads:lead_id (
          name,
          company,
          email
        )
      `)
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending drafts:', error);
      return [];
    }

    // Map the data to our DraftDisplayInfo interface for UI compatibility
    return (data || []).map((item: any) => {
      // Try to get name/company/email from contacts or leads
      const leadName = item.leads?.name || item.contacts?.name || null;
      const company = item.leads?.company || item.contacts?.company || null;
      const targetEmail = item.leads?.email || item.contacts?.email || item.metadata?.target_email || null;

      // Extract confidence from metadata if present
      const confidence = item.metadata?.confidence || null;
      const context = item.metadata?.context || item.plain_text || null;

      return {
        id: item.id,
        lead_name: leadName,
        company: company,
        title: item.persona_used || null,
        confidence: confidence,
        context: context,
        email_subject: item.subject || null,
        email_body: item.body || null,
        target_email: targetEmail,
        status: item.status === 'PENDING_APPROVAL' ? 'PENDING' : item.status,
        created_at: item.created_at || new Date().toISOString(),
      };
    }) as DraftDisplayInfo[];
  } catch (error) {
    console.error('Unexpected error fetching pending drafts:', error);
    return [];
  }
}

/**
 * Updates the status of a draft
 * @param id - The UUID of the draft to update
 * @param status - The new status ('APPROVED' or 'REJECTED')
 * @returns Promise<{data: Draft | null, error: any}> - The updated draft data or error
 */
export async function updateDraftStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<{ data: Draft | null; error: any }> {
  try {
    // Use type assertion to bypass TypeScript checking
    const { data, error } = await (supabase as any)
      .from('ai_drafts')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating draft ${id} status to ${status}:`, error);
      return { data: null, error };
    }

    // Map the response to our Draft interface
    const draft: Draft = {
      id: data.id,
      lead_id: data.lead_id || null,
      contact_id: data.contact_id || null,
      subject: data.subject || '',
      body: data.body || '',
      plain_text: data.plain_text || null,
      persona_used: data.persona_used || 'FRIENDLY_FOUNDER',
      is_ai_draft: data.is_ai_draft ?? true,
      status: data.status || status,
      created_at: data.created_at || new Date().toISOString(),
      metadata: data.metadata || null,
    };

    return { data: draft, error: null };
  } catch (error) {
    console.error(`Unexpected error updating draft ${id}:`, error);
    return { data: null, error };
  }
}

/**
 * Utility function to get all drafts (for testing or admin purposes)
 */
export async function getAllDrafts(): Promise<Draft[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('ai_drafts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all drafts:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      lead_id: item.lead_id || null,
      contact_id: item.contact_id || null,
      subject: item.subject || '',
      body: item.body || '',
      plain_text: item.plain_text || null,
      persona_used: item.persona_used || 'FRIENDLY_FOUNDER',
      is_ai_draft: item.is_ai_draft ?? true,
      status: item.status || 'PENDING_APPROVAL',
      created_at: item.created_at || new Date().toISOString(),
      metadata: item.metadata || null,
    })) as Draft[];
  } catch (error) {
    console.error('Unexpected error fetching all drafts:', error);
    return [];
  }
}

/**
 * Send an email for an approved draft via the send-email Edge Function (SMTP-based)
 *
 * MVP Implementation: Uses global SMTP credentials stored in Supabase Secrets.
 * For multi-tenant support in V2, migrate to OAuth-based gmail-send function.
 *
 * @param draft - The draft display info containing email details
 * @returns Promise<{success: boolean, error?: string}> - Result of the email send operation
 */
export async function sendDraftEmail(draft: DraftDisplayInfo): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate we have a target email
    if (!draft.target_email) {
      console.error('[REGENT] No target email for draft:', draft.id);
      return {
        success: false,
        error: 'No target email address. Add email to lead/contact or metadata.target_email'
      };
    }

    // Validate we have email content
    if (!draft.email_subject || !draft.email_body) {
      console.error('[REGENT] Missing email subject or body for draft:', draft.id);
      return {
        success: false,
        error: 'Missing email subject or body'
      };
    }

    console.log(`[REGENT] Deploying unit to: ${draft.target_email}`);

    // Call the send-email Edge Function (SMTP-based)
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: draft.target_email,
        subject: draft.email_subject,
        html: draft.email_body,
      },
    });

    if (error) {
      console.error('[REGENT] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to invoke send-email function'
      };
    }

    const response = data as SendEmailResponse;

    if (response.error) {
      console.error('[REGENT] Email send error:', response.error, response.details);
      return {
        success: false,
        error: response.details || response.error
      };
    }

    console.log(`[REGENT] Email deployed successfully to: ${draft.target_email}`);
    return { success: true };

  } catch (error) {
    console.error('[REGENT] Unexpected error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Mark a draft as SENT after successful email delivery
 * @param id - The UUID of the draft
 * @returns Promise<{data: Draft | null, error: any}>
 */
export async function markDraftAsSent(id: string): Promise<{ data: Draft | null; error: any }> {
  try {
    const { data, error } = await (supabase as any)
      .from('ai_drafts')
      .update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[REGENT] Error marking draft ${id} as SENT:`, error);
      return { data: null, error };
    }

    return {
      data: {
        id: data.id,
        lead_id: data.lead_id || null,
        contact_id: data.contact_id || null,
        subject: data.subject || '',
        body: data.body || '',
        plain_text: data.plain_text || null,
        persona_used: data.persona_used || 'FRIENDLY_FOUNDER',
        is_ai_draft: data.is_ai_draft ?? true,
        status: data.status,
        created_at: data.created_at || new Date().toISOString(),
        metadata: data.metadata || null,
      },
      error: null
    };
  } catch (error) {
    console.error(`[REGENT] Unexpected error marking draft ${id} as SENT:`, error);
    return { data: null, error };
  }
}