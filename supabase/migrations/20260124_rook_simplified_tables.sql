-- =====================================================
-- ROOK MODULE: Simplified Resume Screening Tables
-- =====================================================
-- Simplified version matching exact requirements for MVP
-- 1. Table `jobs`
-- 2. Table `applicants`
-- 3. RLS Policies for authenticated users

-- =====================================================
-- 1. JOBS TABLE (Simplified)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. APPLICANTS TABLE (Simplified)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'SHORTLISTED', 'REJECTED')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_applicants_job_id ON public.applicants(job_id);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON public.applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_score ON public.applicants(score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_applicants_created_at ON public.applicants(created_at DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY (MVP: Allow all for authenticated)
-- =====================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- Jobs: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users on jobs" ON public.jobs;
CREATE POLICY "Allow all for authenticated users on jobs"
ON public.jobs FOR ALL
USING (auth.role() = 'authenticated');

-- Applicants: Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all for authenticated users on applicants" ON public.applicants;
CREATE POLICY "Allow all for authenticated users on applicants"
ON public.applicants FOR ALL
USING (auth.role() = 'authenticated');

-- =====================================================
-- 5. COMMENTS
-- =====================================================
COMMENT ON TABLE public.jobs IS 'Job postings for resume screening';
COMMENT ON TABLE public.applicants IS 'Job applicants with AI scoring against job descriptions';
COMMENT ON COLUMN public.applicants.resume_text IS 'Raw content extracted from the resume';
COMMENT ON COLUMN public.applicants.score IS 'AI match score (0-100) comparing resume to job description';
COMMENT ON COLUMN public.applicants.analysis IS 'AI feedback { summary, green_flags, red_flags }';