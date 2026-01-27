-- =============================================
-- PAWN MODULE: Scout Missions & Lead Enrichment
-- =============================================
-- Creates the infrastructure for the Pawn (Scout) agent
-- to track missions and enrich lead data.

-- =============================================
-- TABLE: scout_missions (The History)
-- =============================================
CREATE TABLE IF NOT EXISTS public.scout_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Mission Details
  name TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('dragnet', 'dossier')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Dragnet Mode Inputs
  target_role TEXT, -- e.g., "CEO", "VP Sales"
  target_industry TEXT, -- e.g., "B2B SaaS"
  target_location TEXT, -- e.g., "Austin, TX"

  -- Dossier Mode Inputs
  target_domains TEXT[], -- Array of domains to research

  -- Results
  targets_found INT DEFAULT 0,
  targets_verified INT DEFAULT 0,
  targets_promoted INT DEFAULT 0,

  -- Execution Tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Logs (stored as JSONB array)
  execution_log JSONB DEFAULT '[]'::JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scout_missions
CREATE INDEX idx_scout_missions_user ON scout_missions(user_id, created_at DESC);
CREATE INDEX idx_scout_missions_workspace ON scout_missions(workspace_id, created_at DESC);
CREATE INDEX idx_scout_missions_status ON scout_missions(status);

-- RLS for scout_missions
ALTER TABLE scout_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missions"
  ON scout_missions FOR SELECT
  USING (user_id = auth.uid() OR workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create missions"
  ON scout_missions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own missions"
  ON scout_missions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own missions"
  ON scout_missions FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_scout_missions_updated_at
  BEFORE UPDATE ON scout_missions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TABLE: scout_targets (Staging Area)
-- =============================================
-- Temporary holding area before promoting to leads
CREATE TABLE IF NOT EXISTS public.scout_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES scout_missions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Target Information
  name TEXT,
  email TEXT,
  company TEXT,
  domain TEXT,
  role TEXT,
  linkedin_url TEXT,

  -- Enrichment Data
  linkedin_bio TEXT,
  company_description TEXT,
  recent_news_snippet TEXT,
  icebreaker_context TEXT,

  -- Verification
  email_confidence INT DEFAULT 0 CHECK (email_confidence >= 0 AND email_confidence <= 100),
  email_status TEXT DEFAULT 'unverified' CHECK (email_status IN ('unverified', 'valid', 'risky', 'invalid')),

  -- Signal Strength (0-100)
  signal_strength INT DEFAULT 50 CHECK (signal_strength >= 0 AND signal_strength <= 100),

  -- Status
  status TEXT DEFAULT 'staged' CHECK (status IN ('staged', 'promoted', 'discarded')),
  promoted_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scout_targets
CREATE INDEX idx_scout_targets_mission ON scout_targets(mission_id);
CREATE INDEX idx_scout_targets_user ON scout_targets(user_id);
CREATE INDEX idx_scout_targets_status ON scout_targets(status);

-- RLS for scout_targets
ALTER TABLE scout_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own targets"
  ON scout_targets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create targets"
  ON scout_targets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own targets"
  ON scout_targets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own targets"
  ON scout_targets FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- ALTER TABLE: leads (Add Pawn Enrichment Fields)
-- =============================================
-- Add columns if they don't exist
DO $$
BEGIN
  -- LinkedIn bio from profile scraping
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'linkedin_bio') THEN
    ALTER TABLE public.leads ADD COLUMN linkedin_bio TEXT;
  END IF;

  -- Recent news about the company/person
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'recent_news_snippet') THEN
    ALTER TABLE public.leads ADD COLUMN recent_news_snippet TEXT;
  END IF;

  -- AI-generated icebreaker context
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'icebreaker_context') THEN
    ALTER TABLE public.leads ADD COLUMN icebreaker_context TEXT;
  END IF;

  -- Email verification confidence (0-100)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'email_confidence') THEN
    ALTER TABLE public.leads ADD COLUMN email_confidence INT DEFAULT 0;
  END IF;

  -- Reference to the scout mission that found this lead
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source_mission_id') THEN
    ALTER TABLE public.leads ADD COLUMN source_mission_id UUID REFERENCES scout_missions(id) ON DELETE SET NULL;
  END IF;

  -- Signal strength for prioritization
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'signal_strength') THEN
    ALTER TABLE public.leads ADD COLUMN signal_strength INT DEFAULT 50;
  END IF;
END $$;

-- Index for leads by mission
CREATE INDEX IF NOT EXISTS idx_leads_source_mission ON leads(source_mission_id);
