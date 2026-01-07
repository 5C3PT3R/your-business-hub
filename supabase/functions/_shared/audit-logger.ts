/**
 * Audit logging for security-critical actions
 * Immutable logs for compliance and security monitoring
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sanitizeForLogging } from './encryption.ts';

export type AuditAction =
  | 'oauth_connected'
  | 'oauth_disconnected'
  | 'oauth_token_refreshed'
  | 'email_sent'
  | 'email_draft_created'
  | 'email_draft_approved'
  | 'email_draft_rejected'
  | 'email_send_failed'
  | 'message_ingested'
  | 'lead_created'
  | 'activity_created'
  | 'task_created'
  | 'rate_limit_exceeded'
  | 'unauthorized_access_attempt'
  | 'webhook_received'
  | 'webhook_signature_failed';

export type EntityType =
  | 'oauth_token'
  | 'email'
  | 'activity'
  | 'lead'
  | 'task'
  | 'user'
  | 'webhook';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PerformedBy = 'user' | 'ai' | 'system';

export interface AuditLogEntry {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  userId?: string;
  performedBy: PerformedBy;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  riskLevel?: RiskLevel;
}

/**
 * Log an audit event
 * @param supabase - Supabase client with service role
 * @param entry - Audit log entry
 */
export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  try {
    // Sanitize sensitive data before logging
    const sanitizedChanges = entry.changes ? sanitizeForLogging(entry.changes) : null;
    const sanitizedMetadata = entry.metadata ? sanitizeForLogging(entry.metadata) : null;

    await supabase.from('audit_log').insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      user_id: entry.userId,
      performed_by: entry.performedBy,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      changes: sanitizedChanges,
      metadata: sanitizedMetadata,
      risk_level: entry.riskLevel || 'low',
    });

    // Log high-risk events to console for immediate visibility
    if (entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
      console.warn('HIGH RISK AUDIT EVENT:', {
        action: entry.action,
        userId: entry.userId,
        riskLevel: entry.riskLevel,
        metadata: sanitizedMetadata,
      });
    }
  } catch (error) {
    // Never throw - audit logging should not break functionality
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Log OAuth connection event
 */
export async function logOAuthConnected(
  supabase: SupabaseClient,
  userId: string,
  channel: string,
  email: string,
  scopes: string[],
  ipAddress?: string
): Promise<void> {
  await logAudit(supabase, {
    action: 'oauth_connected',
    entityType: 'oauth_token',
    userId,
    performedBy: 'user',
    ipAddress,
    metadata: {
      channel,
      email,
      scopes,
    },
    riskLevel: 'medium',
  });
}

/**
 * Log email sent event
 */
export async function logEmailSent(
  supabase: SupabaseClient,
  userId: string,
  emailId: string,
  to: string,
  subject: string,
  draftSource: 'ai' | 'user' | 'template',
  aiConfidence?: number
): Promise<void> {
  const riskLevel: RiskLevel = draftSource === 'ai' && (aiConfidence || 0) < 0.7 ? 'medium' : 'low';

  await logAudit(supabase, {
    action: 'email_sent',
    entityType: 'email',
    entityId: emailId,
    userId,
    performedBy: draftSource === 'ai' ? 'ai' : 'user',
    metadata: {
      to,
      subject,
      draftSource,
      aiConfidence,
    },
    riskLevel,
  });
}

/**
 * Log failed webhook signature verification (potential attack)
 */
export async function logWebhookSignatureFailed(
  supabase: SupabaseClient,
  channel: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit(supabase, {
    action: 'webhook_signature_failed',
    entityType: 'webhook',
    performedBy: 'system',
    ipAddress,
    userAgent,
    metadata: {
      channel,
      reason: 'Invalid webhook signature - potential tampering or spoofing',
    },
    riskLevel: 'high',
  });
}

/**
 * Log rate limit exceeded event
 */
export async function logRateLimitExceeded(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  ipAddress?: string
): Promise<void> {
  await logAudit(supabase, {
    action: 'rate_limit_exceeded',
    entityType: 'user',
    userId,
    performedBy: 'system',
    ipAddress,
    metadata: {
      endpoint,
    },
    riskLevel: 'medium',
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  supabase: SupabaseClient,
  endpoint: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAudit(supabase, {
    action: 'unauthorized_access_attempt',
    entityType: 'user',
    performedBy: 'system',
    ipAddress,
    userAgent,
    metadata: {
      endpoint,
      reason,
    },
    riskLevel: 'high',
  });
}

/**
 * Get recent high-risk audit events for monitoring
 */
export async function getHighRiskEvents(
  supabase: SupabaseClient,
  hoursBack: number = 24
): Promise<any[]> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursBack);

  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .in('risk_level', ['high', 'critical'])
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  return data || [];
}
