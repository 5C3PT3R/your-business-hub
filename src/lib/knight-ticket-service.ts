/**
 * Knight Ticket Service
 * Manages tickets and messages for The Knight agent
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface Ticket {
  id: string;
  workspace_id: string;
  customer_id?: string;
  source_channel: 'twitter' | 'linkedin' | 'outlook' | 'whatsapp' | 'voice' | 'instagram' | 'facebook';
  source_handle: string;
  status: 'open' | 'pending_user' | 'resolved' | 'escalated';
  sentiment_score: number;
  priority: 'low' | 'medium' | 'critical';
  summary: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  escalated_at?: string;
  metadata?: Record<string, any>;
  message_count?: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'knight' | 'human_agent';
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface TicketDetail {
  ticket: Ticket;
  messages: TicketMessage[];
}

export interface KnightConfig {
  id: string;
  workspace_id: string;
  is_active: boolean;
  auto_reply_enabled: boolean;
  voice_escalation_enabled: boolean;
  sentiment_threshold: number;
  max_auto_replies: number;
  persona_prompt?: string;
  vapi_assistant_id?: string;
  channels_enabled: Record<string, boolean>;
  business_type?: string;
  business_description?: string;
  agent_name?: string;
}

export const BUSINESS_TYPES = [
  { value: 'food_delivery', label: 'Food Delivery', example: 'Like Swiggy, Zomato, DoorDash' },
  { value: 'restaurant', label: 'Restaurant / Cafe', example: 'Dine-in, takeaway, catering' },
  { value: 'ecommerce', label: 'E-Commerce', example: 'Online store, marketplace' },
  { value: 'automotive', label: 'Automotive', example: 'Car dealership, repair, parts' },
  { value: 'healthcare', label: 'Healthcare', example: 'Clinic, pharmacy, telemedicine' },
  { value: 'saas', label: 'SaaS / Software', example: 'Tech product, app support' },
  { value: 'real_estate', label: 'Real Estate', example: 'Properties, rentals, agents' },
  { value: 'education', label: 'Education', example: 'Courses, tutoring, school' },
  { value: 'travel', label: 'Travel & Hospitality', example: 'Hotels, tours, bookings' },
  { value: 'finance', label: 'Finance / Banking', example: 'Loans, insurance, investments' },
  { value: 'fitness', label: 'Fitness & Wellness', example: 'Gym, yoga, spa' },
  { value: 'retail', label: 'Retail Store', example: 'Physical store, chain' },
  { value: 'logistics', label: 'Logistics & Delivery', example: 'Courier, shipping, warehouse' },
  { value: 'general', label: 'General / Other', example: 'Custom business type' },
] as const;

export interface KnightStats {
  total_tickets: number;
  open_tickets: number;
  critical_tickets: number;
  resolved_today: number;
  avg_sentiment: number;
  messages_sent: number;
  escalations: number;
  by_channel: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface CreateTicketParams {
  workspaceId: string;
  sourceChannel: Ticket['source_channel'];
  sourceHandle: string;
  content: string;
  sentimentScore?: number;
  priority?: Ticket['priority'];
  metadata?: Record<string, any>;
}

/**
 * Create a new ticket
 */
export async function createTicket(params: CreateTicketParams): Promise<Ticket | null> {
  try {
    const { data, error } = await supabase.rpc('create_knight_ticket', {
      p_workspace_id: params.workspaceId,
      p_source_channel: params.sourceChannel,
      p_source_handle: params.sourceHandle,
      p_content: params.content,
      p_sentiment_score: params.sentimentScore ?? 5,
      p_priority: params.priority ?? 'medium',
      p_metadata: params.metadata ?? {},
    });

    if (error) {
      console.error('[Knight] Create ticket error:', error);
      return null;
    }

    return data as Ticket;
  } catch (err) {
    console.error('[Knight] Unexpected create ticket error:', err);
    return null;
  }
}

/**
 * Add a message to a ticket
 */
export async function addMessage(
  ticketId: string,
  senderType: TicketMessage['sender_type'],
  content: string,
  metadata?: Record<string, any>
): Promise<TicketMessage | null> {
  try {
    const { data, error } = await supabase.rpc('add_knight_message', {
      p_ticket_id: ticketId,
      p_sender_type: senderType,
      p_content: content,
      p_metadata: metadata ?? {},
    });

    if (error) {
      console.error('[Knight] Add message error:', error);
      return null;
    }

    return data as TicketMessage;
  } catch (err) {
    console.error('[Knight] Unexpected add message error:', err);
    return null;
  }
}

/**
 * Get tickets with filters
 */
export async function getTickets(
  workspaceId: string,
  filters?: {
    status?: Ticket['status'];
    priority?: Ticket['priority'];
    channel?: Ticket['source_channel'];
    limit?: number;
    offset?: number;
  }
): Promise<Ticket[]> {
  try {
    const { data, error } = await supabase.rpc('get_knight_tickets', {
      p_workspace_id: workspaceId,
      p_status: filters?.status ?? null,
      p_priority: filters?.priority ?? null,
      p_channel: filters?.channel ?? null,
      p_limit: filters?.limit ?? 50,
      p_offset: filters?.offset ?? 0,
    });

    if (error) {
      console.error('[Knight] Get tickets error:', error);
      return [];
    }

    return (data || []) as Ticket[];
  } catch (err) {
    console.error('[Knight] Unexpected get tickets error:', err);
    return [];
  }
}

/**
 * Get ticket with all messages
 */
export async function getTicketDetail(ticketId: string): Promise<TicketDetail | null> {
  try {
    const { data, error } = await supabase.rpc('get_knight_ticket_detail', {
      p_ticket_id: ticketId,
    });

    if (error) {
      console.error('[Knight] Get ticket detail error:', error);
      return null;
    }

    return data as TicketDetail;
  } catch (err) {
    console.error('[Knight] Unexpected get ticket detail error:', err);
    return null;
  }
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: Ticket['status'],
  resolutionNote?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_knight_ticket_status', {
      p_ticket_id: ticketId,
      p_status: status,
      p_resolution_note: resolutionNote ?? null,
    });

    if (error) {
      console.error('[Knight] Update ticket status error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Knight] Unexpected update status error:', err);
    return false;
  }
}

/**
 * Get Knight configuration for a workspace
 */
export async function getKnightConfig(workspaceId: string): Promise<KnightConfig | null> {
  try {
    const { data, error } = await supabase.rpc('get_knight_config', {
      p_workspace_id: workspaceId,
    });

    if (error) {
      console.error('[Knight] Get config error:', error);
      return null;
    }

    return data as KnightConfig;
  } catch (err) {
    console.error('[Knight] Unexpected get config error:', err);
    return null;
  }
}

/**
 * Update Knight configuration
 */
export async function updateKnightConfig(
  workspaceId: string,
  config: Partial<KnightConfig>
): Promise<KnightConfig | null> {
  try {
    const { data, error } = await supabase.rpc('update_knight_config', {
      p_workspace_id: workspaceId,
      p_config: config,
    });

    if (error) {
      console.error('[Knight] Update config error:', error);
      return null;
    }

    return data as KnightConfig;
  } catch (err) {
    console.error('[Knight] Unexpected update config error:', err);
    return null;
  }
}

/**
 * Get Knight dashboard stats
 */
export async function getKnightStats(workspaceId: string, days: number = 7): Promise<KnightStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_knight_stats', {
      p_workspace_id: workspaceId,
      p_days: days,
    });

    if (error) {
      console.error('[Knight] Get stats error:', error);
      return null;
    }

    return data as KnightStats;
  } catch (err) {
    console.error('[Knight] Unexpected get stats error:', err);
    return null;
  }
}

/**
 * Find existing open ticket for a source handle
 */
export async function findOpenTicket(
  workspaceId: string,
  sourceHandle: string,
  sourceChannel: Ticket['source_channel']
): Promise<Ticket | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('tickets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('source_handle', sourceHandle)
      .eq('source_channel', sourceChannel)
      .in('status', ['open', 'pending_user'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Knight] Find open ticket error:', error);
      return null;
    }

    return data as Ticket | null;
  } catch (err) {
    console.error('[Knight] Unexpected find ticket error:', err);
    return null;
  }
}

/**
 * Get message count for a ticket
 */
export async function getMessageCount(ticketId: string): Promise<number> {
  try {
    const { count, error } = await (supabase as any)
      .from('ticket_messages')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('[Knight] Get message count error:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('[Knight] Unexpected message count error:', err);
    return 0;
  }
}

/**
 * Delete a ticket and all its messages
 */
export async function deleteTicket(ticketId: string): Promise<boolean> {
  try {
    // Delete activity logs first
    await (supabase as any)
      .from('knight_activity_log')
      .delete()
      .eq('ticket_id', ticketId);

    // Messages cascade on ticket delete, but delete explicitly for safety
    await (supabase as any)
      .from('ticket_messages')
      .delete()
      .eq('ticket_id', ticketId);

    // Delete the ticket
    const { error } = await (supabase as any)
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (error) {
      console.error('[Knight] Delete ticket error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Knight] Unexpected delete ticket error:', err);
    return false;
  }
}

/**
 * Subscribe to ticket updates (real-time)
 */
export function subscribeToTickets(
  workspaceId: string,
  callback: (ticket: Ticket) => void
) {
  return supabase
    .channel(`tickets:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        callback(payload.new as Ticket);
      }
    )
    .subscribe();
}

/**
 * Subscribe to new messages for a ticket
 */
export function subscribeToMessages(
  ticketId: string,
  callback: (message: TicketMessage) => void
) {
  return supabase
    .channel(`messages:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        callback(payload.new as TicketMessage);
      }
    )
    .subscribe();
}
