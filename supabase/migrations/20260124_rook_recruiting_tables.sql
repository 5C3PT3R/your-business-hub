-- =====================================================
-- ROOK MODULE: Recruiting, Screening & Gatekeeping
-- =====================================================
-- The Rook is the Citadel Wall - binary defense for hiring.
-- It scores, sorts, and shortlists candidates automatically.

-- =====================================================
-- 1. JOBS TABLE (The Roles)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Job Details
  title TEXT NOT NULL,
  department TEXT,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT,
  salary_range TEXT,
  employment_type TEXT DEFAULT 'full-time', -- full-time, part-time, contract, internship

  -- Screening Rules
  knockout_rules JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"rule": "Must have 3+ years experience"}, {"rule": "Must be US-based"}]

  must_have_skills TEXT[] DEFAULT '{}',
  nice_to_have_skills TEXT[] DEFAULT '{}',

  -- Status & Metrics
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'FILLED')),
  total_applicants INTEGER DEFAULT 0,
  shortlisted_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- =====================================================
-- 2. APPLICANTS TABLE (The Candidates)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Candidate Info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  current_title TEXT,
  current_company TEXT,
  years_experience INTEGER,
  location TEXT,

  -- Resume Data
  resume_file_url TEXT,
  resume_text TEXT, -- Raw OCR/parsed text from PDF
  resume_parsed_at TIMESTAMPTZ,

  -- The Rook's Analysis
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'F')),
  -- S (90+): Elite - Auto-invite
  -- A (70-89): Bench - Review
  -- B (50-69): Maybe - Needs discussion
  -- C (30-49): Weak - Likely reject
  -- F (<30): Dungeon - Auto-reject

  analysis_summary JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "verdict": "Strong match for senior role",
  --   "green_flags": ["Ex-FAANG", "Open source contributor", "Perfect stack match"],
  --   "red_flags": ["Job hopper (3 roles in 2 years)", "No management experience"],
  --   "knockout_failures": [], -- Which knockout rules they failed
  --   "interview_questions": [
  --     "Why did you leave Company X after only 8 months?",
  --     "Describe a time you led a team through a major technical challenge"
  --   ],
  --   "skills_matched": ["React", "TypeScript", "Node.js"],
  --   "skills_missing": ["Kubernetes", "AWS"]
  -- }

  -- Quick Tags (for UI display)
  tags TEXT[] DEFAULT '{}',
  -- Example: ['Ex-Google', 'Stanford', 'No Degree', 'Remote Only']

  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW',           -- Just uploaded, not yet analyzed
    'ANALYZING',     -- Currently being processed by LLM
    'REVIEWED',      -- Analysis complete, awaiting human decision
    'SHORTLISTED',   -- Moved to interview pipeline
    'INTERVIEWING',  -- In active interview process
    'OFFERED',       -- Offer extended
    'HIRED',         -- Accepted offer
    'REJECTED',      -- Not moving forward
    'WITHDRAWN'      -- Candidate withdrew
  )),

  -- Communication
  last_contacted_at TIMESTAMPTZ,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,

  -- Prevent duplicate applications
  UNIQUE(job_id, email)
);

-- =====================================================
-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_jobs_user ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON public.jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applicants_job ON public.applicants(job_id);
CREATE INDEX IF NOT EXISTS idx_applicants_user ON public.applicants(user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON public.applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_score ON public.applicants(fit_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_applicants_tier ON public.applicants(tier);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON public.applicants(email);
CREATE INDEX IF NOT EXISTS idx_applicants_created ON public.applicants(created_at DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- Jobs: Users can only see their own jobs
DROP POLICY IF EXISTS "Users can read own jobs" ON public.jobs;
CREATE POLICY "Users can read own jobs"
ON public.jobs FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
CREATE POLICY "Users can insert own jobs"
ON public.jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs"
ON public.jobs FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs"
ON public.jobs FOR DELETE
USING (auth.uid() = user_id);

-- Applicants: Users can only see applicants for their own jobs
DROP POLICY IF EXISTS "Users can read own applicants" ON public.applicants;
CREATE POLICY "Users can read own applicants"
ON public.applicants FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own applicants" ON public.applicants;
CREATE POLICY "Users can insert own applicants"
ON public.applicants FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own applicants" ON public.applicants;
CREATE POLICY "Users can update own applicants"
ON public.applicants FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own applicants" ON public.applicants;
CREATE POLICY "Users can delete own applicants"
ON public.applicants FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_updated_at();

CREATE OR REPLACE FUNCTION public.update_applicants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_applicants_updated_at ON public.applicants;
CREATE TRIGGER update_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_applicants_updated_at();

-- Auto-calculate tier based on fit_score
CREATE OR REPLACE FUNCTION public.calculate_applicant_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fit_score IS NOT NULL THEN
    NEW.tier = CASE
      WHEN NEW.fit_score >= 90 THEN 'S'
      WHEN NEW.fit_score >= 70 THEN 'A'
      WHEN NEW.fit_score >= 50 THEN 'B'
      WHEN NEW.fit_score >= 30 THEN 'C'
      ELSE 'F'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_applicant_tier ON public.applicants;
CREATE TRIGGER calculate_applicant_tier
  BEFORE INSERT OR UPDATE OF fit_score ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_applicant_tier();

-- Update job applicant counts
CREATE OR REPLACE FUNCTION public.update_job_applicant_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs
    SET total_applicants = total_applicants + 1
    WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.jobs
    SET total_applicants = GREATEST(0, total_applicants - 1)
    WHERE id = OLD.job_id;
  END IF;

  -- Update shortlisted count
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'SHORTLISTED' THEN
    UPDATE public.jobs
    SET shortlisted_count = (
      SELECT COUNT(*) FROM public.applicants
      WHERE job_id = NEW.job_id AND status = 'SHORTLISTED'
    )
    WHERE id = NEW.job_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'SHORTLISTED' AND NEW.status != 'SHORTLISTED' THEN
    UPDATE public.jobs
    SET shortlisted_count = GREATEST(0, shortlisted_count - 1)
    WHERE id = NEW.job_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_job_applicant_counts ON public.applicants;
CREATE TRIGGER update_job_applicant_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_applicant_counts();

-- =====================================================
-- 6. COMMENTS
-- =====================================================
COMMENT ON TABLE public.jobs IS 'Job postings for the Rook recruiting module';
COMMENT ON TABLE public.applicants IS 'Job applicants with AI-powered scoring and analysis';
COMMENT ON COLUMN public.applicants.fit_score IS 'AI-calculated match score (0-100) comparing resume to job requirements';
COMMENT ON COLUMN public.applicants.tier IS 'Auto-calculated tier: S (Elite), A (Bench), B (Maybe), C (Weak), F (Reject)';
COMMENT ON COLUMN public.applicants.analysis_summary IS 'Structured analysis with green/red flags, interview questions, and skill matches';
COMMENT ON COLUMN public.jobs.knockout_rules IS 'Array of strict requirements that auto-reject if not met';
