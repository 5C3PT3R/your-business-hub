-- BISHOP MASTER PRD: SQL Migrations
-- Creates bishop_settings table and updates leads/ai_drafts

-- ============================================
-- PART 1: BISHOP SETTINGS TABLE (The Soul)
-- ============================================

CREATE TABLE IF NOT EXISTS public.bishop_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  linkedin_profile_url TEXT,
  voice_tone TEXT DEFAULT 'Professional',  -- Direct, Consultative, Friendly, Formal
  signature_html TEXT,

  -- Few-shot learning samples
  golden_samples TEXT[] DEFAULT '{}',  -- Array of user's best past emails

  -- Exclusions
  blacklisted_domains TEXT[] DEFAULT '{}',  -- e.g., ['competitor.com', 'gov']

  -- Strategy toggles
  enable_sniper_intro BOOLEAN DEFAULT TRUE,
  enable_value_nudge BOOLEAN DEFAULT TRUE,
  enable_breakup BOOLEAN DEFAULT TRUE,

  -- Timing (in days)
  days_to_first_followup INTEGER DEFAULT 3,
  days_to_second_followup INTEGER DEFAULT 4,
  days_to_breakup INTEGER DEFAULT 7,

  -- Metadata
  persona_prompt TEXT,  -- Generated from LinkedIn analysis
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bishop_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own bishop settings"
  ON public.bishop_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bishop settings"
  ON public.bishop_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bishop settings"
  ON public.bishop_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bishop settings"
  ON public.bishop_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PART 2: UPDATE LEADS TABLE (The Board)
-- ============================================

-- Add context_log for tracking email history
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS context_log JSONB DEFAULT '[]';

-- Update bishop_status to use full enum
-- Note: We'll handle this in application code since we already have data

COMMENT ON COLUMN public.leads.bishop_status IS 'Status: NEW, CONTACTED, INTERESTED, STALLED, CLOSED, BLACKLISTED';
COMMENT ON COLUMN public.leads.context_log IS 'JSON array of past email summaries sent to this lead';

-- ============================================
-- PART 3: UPDATE AI_DRAFTS TABLE
-- ============================================

-- Add strategy_used column
ALTER TABLE public.ai_drafts
ADD COLUMN IF NOT EXISTS strategy_used TEXT;

COMMENT ON COLUMN public.ai_drafts.strategy_used IS 'Bishop strategy: SNIPER_INTRO, VALUE_NUDGE, BREAKUP, etc.';

-- ============================================
-- PART 4: HELPER FUNCTION
-- ============================================

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_bishop_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS bishop_settings_updated_at ON public.bishop_settings;
CREATE TRIGGER bishop_settings_updated_at
  BEFORE UPDATE ON public.bishop_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bishop_settings_updated_at();

-- ============================================
-- PART 5: DEFAULT SETTINGS FOR EXISTING USERS
-- ============================================

-- Insert default settings for users who don't have them
-- (Run this manually or via a script)
-- INSERT INTO public.bishop_settings (user_id)
-- SELECT id FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.bishop_settings);

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT * FROM public.bishop_settings;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bishop_settings';
