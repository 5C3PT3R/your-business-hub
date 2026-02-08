-- =====================================================
-- Add business configuration fields to knight_config
-- =====================================================

-- Add new columns
ALTER TABLE public.knight_config
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS business_description TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT DEFAULT 'Knight';

-- Update get_knight_config to return new fields
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
        'channels_enabled', channels_enabled,
        'business_type', business_type,
        'business_description', business_description,
        'agent_name', agent_name
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
            'channels_enabled', channels_enabled,
            'business_type', business_type,
            'business_description', business_description,
            'agent_name', agent_name
        ) INTO v_config;
    END IF;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update update_knight_config to handle new fields
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
        channels_enabled,
        business_type,
        business_description,
        agent_name
    ) VALUES (
        p_workspace_id,
        COALESCE((p_config->>'is_active')::boolean, true),
        COALESCE((p_config->>'auto_reply_enabled')::boolean, true),
        COALESCE((p_config->>'voice_escalation_enabled')::boolean, false),
        COALESCE((p_config->>'sentiment_threshold')::integer, 3),
        COALESCE((p_config->>'max_auto_replies')::integer, 3),
        p_config->>'persona_prompt',
        p_config->>'vapi_assistant_id',
        COALESCE(p_config->'channels_enabled', '{"twitter": true, "linkedin": true, "outlook": true, "whatsapp": true}'::jsonb),
        COALESCE(p_config->>'business_type', 'general'),
        p_config->>'business_description',
        COALESCE(p_config->>'agent_name', 'Knight')
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
        business_type = COALESCE(p_config->>'business_type', knight_config.business_type),
        business_description = COALESCE(p_config->>'business_description', knight_config.business_description),
        agent_name = COALESCE(p_config->>'agent_name', knight_config.agent_name),
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
        'channels_enabled', channels_enabled,
        'business_type', business_type,
        'business_description', business_description,
        'agent_name', agent_name
    ) INTO v_config;

    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
