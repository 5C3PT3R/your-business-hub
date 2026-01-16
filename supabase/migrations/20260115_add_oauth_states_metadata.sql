-- Add metadata column to oauth_states table for storing platform-specific data
ALTER TABLE IF EXISTS public.oauth_states
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Comment for documentation
COMMENT ON COLUMN oauth_states.metadata IS 'Stores platform type, tokens, and other OAuth flow data';
