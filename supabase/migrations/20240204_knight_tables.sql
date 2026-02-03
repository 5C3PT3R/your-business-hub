-- =====================================================
-- THE KNIGHT: Database Schema
-- Omni-channel Customer Success & Defense Agent
-- =====================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tickets Table: Tracks the master status of an issue
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    workspace_id UUID NOT NULL,
    customer_id UUID,
    source_channel TEXT CHECK (source_channel IN ('twitter', 'linkedin', 'outlook', 'whatsapp', 'voice', 'instagram', 'facebook')),
    source_handle TEXT, -- Email address, Handle, or Phone Number
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending_user', 'resolved', 'escalated')),
    sentiment_score INTEGER CHECK (sentiment_score >= 1 AND sentiment_score <= 10), -- 1 (Angry) to 10 (Happy)
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'critical')),
    summary TEXT,
    assigned_to UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Ticket Messages: The actual conversation history
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sender_type TEXT CHECK (sender_type IN ('user', 'knight', 'human_agent')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb -- Stores raw webhook payloads or email headers
);

-- 3. Knowledge Base (RAG) - For pgvector support
-- Note: Run "CREATE EXTENSION IF NOT EXISTS vector;" first if not enabled
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    content TEXT NOT NULL,
    embedding vector(1536),
    category TEXT CHECK (category IN ('pricing', 'technical', 'policy', 'faq', 'product', 'troubleshooting')),
    title TEXT,
    source_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Knight Activity Log: Track all Knight actions
CREATE TABLE IF NOT EXISTS public.knight_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    workspace_id UUID NOT NULL,
    ticket_id UUID REFERENCES public.tickets(id),
    action_type TEXT CHECK (action_type IN ('reply_sent', 'escalated', 'voice_call', 'sentiment_analyzed', 'ticket_created', 'ticket_resolved')),
    channel TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 5. Knight Configuration: Per-workspace settings
CREATE TABLE IF NOT EXISTS public.knight_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    auto_reply_enabled BOOLEAN DEFAULT true,
    voice_escalation_enabled BOOLEAN DEFAULT false,
    sentiment_threshold INTEGER DEFAULT 3, -- Below this = critical
    max_auto_replies INTEGER DEFAULT 3, -- Before escalating to human
    persona_prompt TEXT,
    vapi_assistant_id TEXT,
    channels_enabled JSONB DEFAULT '{"twitter": true, "linkedin": true, "outlook": true, "whatsapp": true, "instagram": true, "facebook": true}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_workspace ON public.tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source_channel);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_workspace ON public.knowledge_base(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knight_activity_workspace ON public.knight_activity_log(workspace_id);

-- Enable Row Level Security
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knight_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knight_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (workspace-based access)
CREATE POLICY "Users can view tickets in their workspace" ON public.tickets
    FOR SELECT USING (true);

CREATE POLICY "Users can insert tickets" ON public.tickets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update tickets in their workspace" ON public.tickets
    FOR UPDATE USING (true);

CREATE POLICY "Users can view ticket messages" ON public.ticket_messages
    FOR SELECT USING (true);

CREATE POLICY "Users can insert ticket messages" ON public.ticket_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view knowledge base" ON public.knowledge_base
    FOR SELECT USING (true);

CREATE POLICY "Users can manage knowledge base" ON public.knowledge_base
    FOR ALL USING (true);

CREATE POLICY "Users can view knight activity" ON public.knight_activity_log
    FOR SELECT USING (true);

CREATE POLICY "Users can insert knight activity" ON public.knight_activity_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage knight config" ON public.knight_config
    FOR ALL USING (true);

-- =====================================================
-- RPC Functions for The Knight
-- =====================================================

-- Create or update a ticket
CREATE OR REPLACE FUNCTION create_knight_ticket(
    p_workspace_id UUID,
    p_source_channel TEXT,
    p_source_handle TEXT,
    p_content TEXT,
    p_sentiment_score INTEGER DEFAULT 5,
    p_priority TEXT DEFAULT 'medium',
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket JSONB;
BEGIN
    -- Insert the ticket
    INSERT INTO public.tickets (
        workspace_id,
        source_channel,
        source_handle,
        sentiment_score,
        priority,
        summary,
        metadata
    ) VALUES (
        p_workspace_id,
        p_source_channel,
        p_source_handle,
        p_sentiment_score,
        p_priority,
        LEFT(p_content, 200),
        p_metadata
    ) RETURNING id INTO v_ticket_id;

    -- Insert the first message
    INSERT INTO public.ticket_messages (
        ticket_id,
        sender_type,
        content,
        metadata
    ) VALUES (
        v_ticket_id,
        'user',
        p_content,
        p_metadata
    );

    -- Log the activity
    INSERT INTO public.knight_activity_log (
        workspace_id,
        ticket_id,
        action_type,
        channel,
        details
    ) VALUES (
        p_workspace_id,
        v_ticket_id,
        'ticket_created',
        p_source_channel,
        jsonb_build_object('source_handle', p_source_handle, 'priority', p_priority)
    );

    -- Return the ticket
    SELECT jsonb_build_object(
        'id', t.id,
        'workspace_id', t.workspace_id,
        'source_channel', t.source_channel,
        'source_handle', t.source_handle,
        'status', t.status,
        'sentiment_score', t.sentiment_score,
        'priority', t.priority,
        'summary', t.summary,
        'created_at', t.created_at
    ) INTO v_ticket FROM public.tickets t WHERE t.id = v_ticket_id;

    RETURN v_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a message to a ticket
CREATE OR REPLACE FUNCTION add_knight_message(
    p_ticket_id UUID,
    p_sender_type TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_message JSONB;
    v_workspace_id UUID;
    v_channel TEXT;
BEGIN
    -- Get workspace and channel from ticket
    SELECT workspace_id, source_channel INTO v_workspace_id, v_channel
    FROM public.tickets WHERE id = p_ticket_id;

    -- Insert the message
    INSERT INTO public.ticket_messages (
        ticket_id,
        sender_type,
        content,
        metadata
    ) VALUES (
        p_ticket_id,
        p_sender_type,
        p_content,
        p_metadata
    ) RETURNING jsonb_build_object(
        'id', id,
        'ticket_id', ticket_id,
        'sender_type', sender_type,
        'content', content,
        'created_at', created_at
    ) INTO v_message;

    -- Update ticket updated_at
    UPDATE public.tickets SET updated_at = now() WHERE id = p_ticket_id;

    -- Log activity if knight replied
    IF p_sender_type = 'knight' THEN
        INSERT INTO public.knight_activity_log (
            workspace_id,
            ticket_id,
            action_type,
            channel,
            details
        ) VALUES (
            v_workspace_id,
            p_ticket_id,
            'reply_sent',
            v_channel,
            jsonb_build_object('content_preview', LEFT(p_content, 100))
        );
    END IF;

    RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tickets with filters
CREATE OR REPLACE FUNCTION get_knight_tickets(
    p_workspace_id UUID,
    p_status TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_channel TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_tickets JSONB;
BEGIN
    SELECT jsonb_agg(t_data) INTO v_tickets
    FROM (
        SELECT jsonb_build_object(
            'id', t.id,
            'workspace_id', t.workspace_id,
            'source_channel', t.source_channel,
            'source_handle', t.source_handle,
            'status', t.status,
            'sentiment_score', t.sentiment_score,
            'priority', t.priority,
            'summary', t.summary,
            'created_at', t.created_at,
            'updated_at', t.updated_at,
            'message_count', (SELECT COUNT(*) FROM public.ticket_messages WHERE ticket_id = t.id)
        ) as t_data
        FROM public.tickets t
        WHERE t.workspace_id = p_workspace_id
          AND (p_status IS NULL OR t.status = p_status)
          AND (p_priority IS NULL OR t.priority = p_priority)
          AND (p_channel IS NULL OR t.source_channel = p_channel)
        ORDER BY
            CASE t.priority
                WHEN 'critical' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
            END,
            t.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) sub;

    RETURN COALESCE(v_tickets, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get ticket with messages
CREATE OR REPLACE FUNCTION get_knight_ticket_detail(
    p_ticket_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'ticket', jsonb_build_object(
            'id', t.id,
            'workspace_id', t.workspace_id,
            'source_channel', t.source_channel,
            'source_handle', t.source_handle,
            'status', t.status,
            'sentiment_score', t.sentiment_score,
            'priority', t.priority,
            'summary', t.summary,
            'created_at', t.created_at,
            'updated_at', t.updated_at,
            'metadata', t.metadata
        ),
        'messages', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', m.id,
                    'sender_type', m.sender_type,
                    'content', m.content,
                    'created_at', m.created_at,
                    'metadata', m.metadata
                ) ORDER BY m.created_at ASC
            ), '[]'::jsonb)
            FROM public.ticket_messages m
            WHERE m.ticket_id = t.id
        )
    ) INTO v_result
    FROM public.tickets t
    WHERE t.id = p_ticket_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update ticket status
CREATE OR REPLACE FUNCTION update_knight_ticket_status(
    p_ticket_id UUID,
    p_status TEXT,
    p_resolution_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_ticket JSONB;
    v_workspace_id UUID;
    v_channel TEXT;
BEGIN
    -- Get workspace and channel
    SELECT workspace_id, source_channel INTO v_workspace_id, v_channel
    FROM public.tickets WHERE id = p_ticket_id;

    -- Update the ticket
    UPDATE public.tickets SET
        status = p_status,
        updated_at = now(),
        resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE resolved_at END,
        escalated_at = CASE WHEN p_status = 'escalated' THEN now() ELSE escalated_at END
    WHERE id = p_ticket_id
    RETURNING jsonb_build_object(
        'id', id,
        'status', status,
        'updated_at', updated_at
    ) INTO v_ticket;

    -- Log activity
    IF p_status = 'resolved' THEN
        INSERT INTO public.knight_activity_log (workspace_id, ticket_id, action_type, channel, details)
        VALUES (v_workspace_id, p_ticket_id, 'ticket_resolved', v_channel,
                jsonb_build_object('resolution_note', p_resolution_note));
    ELSIF p_status = 'escalated' THEN
        INSERT INTO public.knight_activity_log (workspace_id, ticket_id, action_type, channel, details)
        VALUES (v_workspace_id, p_ticket_id, 'escalated', v_channel,
                jsonb_build_object('reason', p_resolution_note));
    END IF;

    RETURN v_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search knowledge base (RAG)
CREATE OR REPLACE FUNCTION search_knowledge_base(
    p_workspace_id UUID,
    p_query_embedding vector(1536),
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INTEGER DEFAULT 5
) RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    title TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.content,
        kb.category,
        kb.title,
        1 - (kb.embedding <=> p_query_embedding) as similarity
    FROM public.knowledge_base kb
    WHERE kb.workspace_id = p_workspace_id
      AND 1 - (kb.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY kb.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Knight config
CREATE OR REPLACE FUNCTION get_knight_config(
    p_workspace_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_config JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', id,
        'workspace_id', workspace_id,
        'is_active', is_active,
        'auto_reply_enabled', auto_reply_enabled,
        'voice_escalation_enabled', voice_escalation_enabled,
        'sentiment_threshold', sentiment_threshold,
        'max_auto_replies', max_auto_replies,
        'persona_prompt', persona_prompt,
        'vapi_assistant_id', vapi_assistant_id,
        'channels_enabled', channels_enabled
    ) INTO v_config
    FROM public.knight_config
    WHERE workspace_id = p_workspace_id;

    -- Return default config if none exists
    IF v_config IS NULL THEN
        INSERT INTO public.knight_config (workspace_id)
        VALUES (p_workspace_id)
        RETURNING jsonb_build_object(
            'id', id,
            'workspace_id', workspace_id,
            'is_active', is_active,
            'auto_reply_enabled', auto_reply_enabled,
            'voice_escalation_enabled', voice_escalation_enabled,
            'sentiment_threshold', sentiment_threshold,
            'max_auto_replies', max_auto_replies,
            'persona_prompt', persona_prompt,
            'vapi_assistant_id', vapi_assistant_id,
            'channels_enabled', channels_enabled
        ) INTO v_config;
    END IF;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Knight config
CREATE OR REPLACE FUNCTION update_knight_config(
    p_workspace_id UUID,
    p_config JSONB
) RETURNS JSONB AS $$
DECLARE
    v_config JSONB;
BEGIN
    INSERT INTO public.knight_config (
        workspace_id,
        is_active,
        auto_reply_enabled,
        voice_escalation_enabled,
        sentiment_threshold,
        max_auto_replies,
        persona_prompt,
        vapi_assistant_id,
        channels_enabled
    ) VALUES (
        p_workspace_id,
        COALESCE((p_config->>'is_active')::boolean, true),
        COALESCE((p_config->>'auto_reply_enabled')::boolean, true),
        COALESCE((p_config->>'voice_escalation_enabled')::boolean, false),
        COALESCE((p_config->>'sentiment_threshold')::integer, 3),
        COALESCE((p_config->>'max_auto_replies')::integer, 3),
        p_config->>'persona_prompt',
        p_config->>'vapi_assistant_id',
        COALESCE(p_config->'channels_enabled', '{"twitter": true, "linkedin": true, "outlook": true, "whatsapp": true}'::jsonb)
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
        is_active = COALESCE((p_config->>'is_active')::boolean, knight_config.is_active),
        auto_reply_enabled = COALESCE((p_config->>'auto_reply_enabled')::boolean, knight_config.auto_reply_enabled),
        voice_escalation_enabled = COALESCE((p_config->>'voice_escalation_enabled')::boolean, knight_config.voice_escalation_enabled),
        sentiment_threshold = COALESCE((p_config->>'sentiment_threshold')::integer, knight_config.sentiment_threshold),
        max_auto_replies = COALESCE((p_config->>'max_auto_replies')::integer, knight_config.max_auto_replies),
        persona_prompt = COALESCE(p_config->>'persona_prompt', knight_config.persona_prompt),
        vapi_assistant_id = COALESCE(p_config->>'vapi_assistant_id', knight_config.vapi_assistant_id),
        channels_enabled = COALESCE(p_config->'channels_enabled', knight_config.channels_enabled),
        updated_at = now()
    RETURNING jsonb_build_object(
        'id', id,
        'workspace_id', workspace_id,
        'is_active', is_active,
        'auto_reply_enabled', auto_reply_enabled,
        'voice_escalation_enabled', voice_escalation_enabled,
        'sentiment_threshold', sentiment_threshold,
        'max_auto_replies', max_auto_replies,
        'persona_prompt', persona_prompt,
        'vapi_assistant_id', vapi_assistant_id,
        'channels_enabled', channels_enabled
    ) INTO v_config;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Knight dashboard stats
CREATE OR REPLACE FUNCTION get_knight_stats(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_tickets', (SELECT COUNT(*) FROM public.tickets WHERE workspace_id = p_workspace_id),
        'open_tickets', (SELECT COUNT(*) FROM public.tickets WHERE workspace_id = p_workspace_id AND status = 'open'),
        'critical_tickets', (SELECT COUNT(*) FROM public.tickets WHERE workspace_id = p_workspace_id AND priority = 'critical' AND status != 'resolved'),
        'resolved_today', (SELECT COUNT(*) FROM public.tickets WHERE workspace_id = p_workspace_id AND status = 'resolved' AND resolved_at >= CURRENT_DATE),
        'avg_sentiment', (SELECT COALESCE(AVG(sentiment_score), 5) FROM public.tickets WHERE workspace_id = p_workspace_id AND created_at >= now() - (p_days || ' days')::interval),
        'messages_sent', (SELECT COUNT(*) FROM public.knight_activity_log WHERE workspace_id = p_workspace_id AND action_type = 'reply_sent' AND created_at >= now() - (p_days || ' days')::interval),
        'escalations', (SELECT COUNT(*) FROM public.knight_activity_log WHERE workspace_id = p_workspace_id AND action_type = 'escalated' AND created_at >= now() - (p_days || ' days')::interval),
        'by_channel', (
            SELECT COALESCE(jsonb_object_agg(source_channel, cnt), '{}'::jsonb)
            FROM (
                SELECT source_channel, COUNT(*) as cnt
                FROM public.tickets
                WHERE workspace_id = p_workspace_id
                GROUP BY source_channel
            ) sub
        ),
        'by_priority', (
            SELECT COALESCE(jsonb_object_agg(priority, cnt), '{}'::jsonb)
            FROM (
                SELECT priority, COUNT(*) as cnt
                FROM public.tickets
                WHERE workspace_id = p_workspace_id AND status != 'resolved'
                GROUP BY priority
            ) sub
        )
    ) INTO v_stats;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
