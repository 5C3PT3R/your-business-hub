-- DAY 5: THE CASTLE - Multi-tenancy & Row Level Security
-- Goal: One user can NEVER see another user's data

-- ============================================
-- PART 1: ENSURE USER_ID EXISTS
-- ============================================

-- leads.user_id already exists from initial migration
-- ai_drafts.user_id already exists from ai_drafts migration

-- Ensure user_id is NOT NULL on ai_drafts (may have been nullable)
-- First, we need to handle any NULL values

-- ============================================
-- PART 2: ENABLE RLS (IDEMPOTENT)
-- ============================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: LEADS POLICIES (DROP AND RECREATE)
-- ============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

-- Create simple user_id based policies
-- Policy: Users can only SELECT their own leads
CREATE POLICY "Users can read own leads"
ON public.leads FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT leads with their own user_id
CREATE POLICY "Users can insert own leads"
ON public.leads FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own leads
CREATE POLICY "Users can update own leads"
ON public.leads FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can only DELETE their own leads
CREATE POLICY "Users can delete own leads"
ON public.leads FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- PART 4: AI_DRAFTS POLICIES (DROP AND RECREATE)
-- ============================================

-- Drop existing workspace-based policies
DROP POLICY IF EXISTS "Users can view AI drafts in their workspace" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can create AI drafts in their workspace" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can update their own AI drafts" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can read own drafts" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can insert own drafts" ON public.ai_drafts;

-- Create simple user_id based policies
-- Policy: Users can only SELECT their own drafts
CREATE POLICY "Users can read own drafts"
ON public.ai_drafts FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT drafts with their own user_id
CREATE POLICY "Users can insert own drafts"
ON public.ai_drafts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own drafts
CREATE POLICY "Users can update own drafts"
ON public.ai_drafts FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- PART 5: COMMENTS FOR CLARITY
-- ============================================

COMMENT ON POLICY "Users can read own leads" ON public.leads IS 'RLS: Users can only see their own leads';
COMMENT ON POLICY "Users can insert own leads" ON public.leads IS 'RLS: Users can only create leads for themselves';
COMMENT ON POLICY "Users can update own leads" ON public.leads IS 'RLS: Users can only modify their own leads';
COMMENT ON POLICY "Users can delete own leads" ON public.leads IS 'RLS: Users can only delete their own leads';

COMMENT ON POLICY "Users can read own drafts" ON public.ai_drafts IS 'RLS: Users can only see their own drafts';
COMMENT ON POLICY "Users can insert own drafts" ON public.ai_drafts IS 'RLS: Users can only create drafts for themselves';
COMMENT ON POLICY "Users can update own drafts" ON public.ai_drafts IS 'RLS: Users can only modify their own drafts';

-- ============================================
-- VERIFICATION QUERIES (run manually to test)
-- ============================================
-- SELECT * FROM leads; -- Should return only current user's leads
-- SELECT * FROM ai_drafts; -- Should return only current user's drafts
