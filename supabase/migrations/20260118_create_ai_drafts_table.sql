-- Create AI drafts table for SDR agent-generated email drafts
-- This table stores AI-generated email drafts that need approval before sending

CREATE TABLE IF NOT EXISTS public.ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  
  -- Draft content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  plain_text TEXT, -- Plain text version for quick preview
  
  -- AI generation metadata
  persona_used TEXT NOT NULL DEFAULT 'FRIENDLY_FOUNDER',
  is_ai_draft BOOLEAN NOT NULL DEFAULT TRUE,
  ai_model_used TEXT DEFAULT 'gpt-4o-mini',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' 
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'ARCHIVED')),
  
  -- Approval metadata
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Sent metadata (if sent)
  sent_at TIMESTAMPTZ,
  sent_via_channel TEXT CHECK (sent_via_channel IN ('email', 'linkedin', 'whatsapp', 'sms')),
  external_message_id TEXT, -- External ID if sent via email/LinkedIn/etc.
  
  -- Performance tracking
  open_rate DECIMAL(5, 2) CHECK (open_rate >= 0 AND open_rate <= 100),
  click_rate DECIMAL(5, 2) CHECK (click_rate >= 0 AND click_rate <= 100),
  reply_received BOOLEAN DEFAULT FALSE,
  
  -- Versioning (for draft iterations)
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES public.ai_drafts(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_drafts_workspace ON public.ai_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_user ON public.ai_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_lead ON public.ai_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status ON public.ai_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created ON public.ai_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_persona ON public.ai_drafts(persona_used);

-- Enable Row Level Security
ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view AI drafts in their workspace" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can create AI drafts in their workspace" ON public.ai_drafts;
DROP POLICY IF EXISTS "Users can update their own AI drafts" ON public.ai_drafts;

-- RLS Policy: Users can view AI drafts in workspaces they are members of
CREATE POLICY "Users can view AI drafts in their workspace"
ON public.ai_drafts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ai_drafts.workspace_id
    AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ai_drafts.workspace_id
    AND owner_id = auth.uid()
  )
);

-- RLS Policy: Users can create AI drafts in workspaces they are members of
CREATE POLICY "Users can create AI drafts in their workspace"
ON public.ai_drafts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = ai_drafts.workspace_id
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = ai_drafts.workspace_id
      AND owner_id = auth.uid()
    )
  )
);

-- RLS Policy: Users can update their own AI drafts
CREATE POLICY "Users can update their own AI drafts"
ON public.ai_drafts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ai_drafts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS update_ai_drafts_updated_at ON public.ai_drafts;

-- Create trigger for updated_at
CREATE TRIGGER update_ai_drafts_updated_at
  BEFORE UPDATE ON public.ai_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_drafts_updated_at();

-- Function to track AI usage when draft is created
CREATE OR REPLACE FUNCTION public.track_ai_draft_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only track if it's an AI draft
  IF NEW.is_ai_draft = TRUE THEN
    -- Call the track_ai_usage function for the workspace
    PERFORM public.track_ai_usage(NEW.workspace_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS track_ai_draft_usage_trigger ON public.ai_drafts;

-- Create trigger to track AI usage
CREATE TRIGGER track_ai_draft_usage_trigger
  AFTER INSERT ON public.ai_drafts
  FOR EACH ROW
  WHEN (NEW.is_ai_draft = TRUE)
  EXECUTE FUNCTION public.track_ai_draft_usage();

-- Comments
COMMENT ON TABLE public.ai_drafts IS 'AI-generated email drafts for SDR agents, requiring approval before sending';
COMMENT ON COLUMN public.ai_drafts.persona_used IS 'AI persona used for generation: FRIENDLY_FOUNDER, DIRECT_SALES, HELPFUL_TEACHER, etc.';
COMMENT ON COLUMN public.ai_drafts.status IS 'Workflow status: PENDING_APPROVAL, APPROVED, REJECTED, SENT, ARCHIVED';
COMMENT ON COLUMN public.ai_drafts.is_ai_draft IS 'Whether this draft was generated by AI (vs manually created)';

-- Create enum type for persona if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.ai_persona AS ENUM ('FRIENDLY_FOUNDER', 'DIRECT_SALES', 'HELPFUL_TEACHER', 'EXPERT_ADVISOR', 'COLD_OUTREACH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional: Add constraint for persona_used if using enum
-- ALTER TABLE public.ai_drafts 
--   ADD CONSTRAINT ai_drafts_persona_check 
--   CHECK (persona_used IN ('FRIENDLY_FOUNDER', 'DIRECT_SALES', 'HELPFUL_TEACHER', 'EXPERT_ADVISOR', 'COLD_OUTREACH'));