-- =============================================
-- OAuth States Table
-- =============================================
-- Stores temporary OAuth state parameters for CSRF protection
-- Used by Meta OAuth and other social integrations

CREATE TABLE IF NOT EXISTS public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT oauth_states_state_unique UNIQUE (state)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON public.oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Edge Functions use service role)
CREATE POLICY "Service role full access" ON public.oauth_states
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Users can only see their own states
CREATE POLICY "Users can view own states" ON public.oauth_states
    FOR SELECT
    USING (auth.uid() = user_id);

-- Auto-cleanup expired states (optional - can be done via cron)
-- This function can be called periodically to clean up
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.oauth_states TO service_role;
GRANT SELECT, INSERT, DELETE ON public.oauth_states TO authenticated;
