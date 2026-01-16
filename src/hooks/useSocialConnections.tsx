import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  SocialConnection,
  SocialConversation,
  SocialMessage,
  WhatsAppTemplate,
  SocialPlatform,
} from '@/types/inbox';

export function useSocialConnections() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { workspace } = useWorkspace();

  const fetchConnections = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped = (data || []).map((conn: any) => ({
        id: conn.id,
        userId: conn.user_id,
        workspaceId: conn.workspace_id,
        platform: conn.platform as SocialPlatform,
        platformAccountId: conn.platform_account_id,
        platformAccountName: conn.platform_account_name,
        status: conn.status,
        lastError: conn.last_error,
        lastSyncAt: conn.last_sync_at ? new Date(conn.last_sync_at) : undefined,
        phoneNumberId: conn.phone_number_id,
        whatsappBusinessId: conn.whatsapp_business_id,
        pageId: conn.page_id,
        pageName: conn.page_name,
        instagramAccountId: conn.instagram_account_id,
        linkedinUrn: conn.linkedin_urn,
        createdAt: new Date(conn.created_at),
        updatedAt: new Date(conn.updated_at),
      }));

      setConnections(mapped);
    } catch (err: any) {
      console.error('Error fetching social connections:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const addConnection = async (
    platform: SocialPlatform,
    data: Partial<SocialConnection>
  ): Promise<SocialConnection | null> => {
    if (!workspace?.id) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: newConn, error: insertError } = await supabase
        .from('social_connections')
        .insert([{
          user_id: userData.user.id,
          workspace_id: workspace.id,
          platform,
          platform_account_id: data.platformAccountId,
          platform_account_name: data.platformAccountName,
          phone_number_id: data.phoneNumberId,
          whatsapp_business_id: data.whatsappBusinessId,
          page_id: data.pageId,
          page_name: data.pageName,
          instagram_account_id: data.instagramAccountId,
          linkedin_urn: data.linkedinUrn,
          status: 'active',
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchConnections();
      return newConn as SocialConnection;
    } catch (err: any) {
      console.error('Error adding social connection:', err);
      setError(err.message);
      return null;
    }
  };

  const disconnectConnection = async (connectionId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('social_connections')
        .update({ status: 'disconnected' })
        .eq('id', connectionId);

      if (updateError) throw updateError;

      setConnections(prev =>
        prev.map(c => c.id === connectionId ? { ...c, status: 'disconnected' as const } : c)
      );
      return true;
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteConnection = async (connectionId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', connectionId);

      if (deleteError) throw deleteError;

      setConnections(prev => prev.filter(c => c.id !== connectionId));
      return true;
    } catch (err: any) {
      console.error('Error deleting connection:', err);
      setError(err.message);
      return false;
    }
  };

  // Get connections by platform
  const getConnectionsByPlatform = (platform: SocialPlatform) => {
    return connections.filter(c => c.platform === platform && c.status === 'active');
  };

  // Stats
  const stats = {
    total: connections.length,
    active: connections.filter(c => c.status === 'active').length,
    whatsapp: connections.filter(c => c.platform === 'whatsapp' && c.status === 'active').length,
    messenger: connections.filter(c => c.platform === 'messenger' && c.status === 'active').length,
    instagram: connections.filter(c => c.platform === 'instagram' && c.status === 'active').length,
    linkedin: connections.filter(c => c.platform === 'linkedin' && c.status === 'active').length,
  };

  return {
    connections,
    loading,
    error,
    stats,
    fetchConnections,
    addConnection,
    disconnectConnection,
    deleteConnection,
    getConnectionsByPlatform,
  };
}

// Hook for WhatsApp Templates
export function useWhatsAppTemplates(connectionId?: string) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { workspace } = useWorkspace();

  const fetchTemplates = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('status', 'approved');

      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;

      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        workspaceId: t.workspace_id,
        connectionId: t.connection_id,
        templateId: t.template_id,
        name: t.name,
        language: t.language,
        category: t.category,
        headerType: t.header_type,
        headerText: t.header_text,
        bodyText: t.body_text,
        footerText: t.footer_text,
        variables: t.variables || [],
        buttons: t.buttons || [],
        status: t.status,
        rejectionReason: t.rejection_reason,
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      }));

      setTemplates(mapped);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, connectionId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, fetchTemplates };
}

// Hook for Social Conversations
export function useSocialConversations(platform?: SocialPlatform) {
  const [conversations, setConversations] = useState<SocialConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { workspace } = useWorkspace();

  const fetchConversations = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('social_conversations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .neq('status', 'archived')
        .order('last_message_at', { ascending: false });

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        workspaceId: c.workspace_id,
        connectionId: c.connection_id,
        contactId: c.contact_id,
        platform: c.platform as SocialPlatform,
        platformConversationId: c.platform_conversation_id,
        platformUserId: c.platform_user_id,
        platformUserName: c.platform_user_name,
        platformUserAvatar: c.platform_user_avatar,
        sessionExpiresAt: c.session_expires_at ? new Date(c.session_expires_at) : undefined,
        requiresTemplate: c.requires_template,
        status: c.status,
        messageCount: c.message_count,
        unreadCount: c.unread_count,
        lastMessageAt: c.last_message_at ? new Date(c.last_message_at) : undefined,
        lastInboundAt: c.last_inbound_at ? new Date(c.last_inbound_at) : undefined,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
      }));

      setConversations(mapped);
    } catch (err) {
      console.error('Error fetching social conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, platform]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Check if WhatsApp session is expired
  const isSessionExpired = (conversation: SocialConversation): boolean => {
    if (conversation.platform !== 'whatsapp') return false;
    if (!conversation.sessionExpiresAt) return true;
    return new Date() > conversation.sessionExpiresAt;
  };

  return { conversations, loading, fetchConversations, isSessionExpired };
}

// Hook for Social Messages within a conversation
export function useSocialMessages(conversationId?: string) {
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('social_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((m: any) => ({
        id: m.id,
        workspaceId: m.workspace_id,
        conversationId: m.conversation_id,
        platform: m.platform as SocialPlatform,
        externalId: m.external_id,
        direction: m.direction,
        messageType: m.message_type,
        body: m.body,
        caption: m.caption,
        mediaUrl: m.media_url,
        mediaMimeType: m.media_mime_type,
        mediaFilename: m.media_filename,
        mediaSize: m.media_size,
        templateId: m.template_id,
        templateVariables: m.template_variables,
        status: m.status,
        statusUpdatedAt: m.status_updated_at ? new Date(m.status_updated_at) : undefined,
        errorCode: m.error_code,
        errorMessage: m.error_message,
        replyToId: m.reply_to_id,
        reactionEmoji: m.reaction_emoji,
        sourcePageName: m.source_page_name,
        sentAt: new Date(m.sent_at),
        deliveredAt: m.delivered_at ? new Date(m.delivered_at) : undefined,
        readAt: m.read_at ? new Date(m.read_at) : undefined,
        createdAt: new Date(m.created_at),
      }));

      setMessages(mapped);
    } catch (err) {
      console.error('Error fetching social messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return { messages, loading, fetchMessages };
}

// Hook for sending social messages
export function useSendSocialMessage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async ({
    connectionId,
    conversationId,
    recipientId,
    messageType,
    content,
    templateName,
    templateLanguage,
    templateVariables,
    mediaUrl,
    caption,
  }: {
    connectionId: string;
    conversationId?: string;
    recipientId: string;
    messageType: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio';
    content?: string;
    templateName?: string;
    templateLanguage?: string;
    templateVariables?: Record<string, string>;
    mediaUrl?: string;
    caption?: string;
  }): Promise<{ success: boolean; messageId?: string; conversationId?: string; error?: string }> => {
    setSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-social-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            connectionId,
            conversationId,
            recipientId,
            messageType,
            content,
            templateName,
            templateLanguage,
            templateVariables,
            mediaUrl,
            caption,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      return {
        success: true,
        messageId: result.messageId,
        conversationId: result.conversationId,
      };
    } catch (err: any) {
      console.error('Error sending social message:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, sending, error };
}
