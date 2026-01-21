-- AI Email Approvals Queue
-- Stores AI-drafted emails pending human review before sending

CREATE TABLE IF NOT EXISTS public.email_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Agent info
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,

  -- Email content
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,

  -- Context
  context TEXT, -- Why the agent drafted this email

  -- Related entities
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'edited', 'sent', 'failed')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Feedback for AI training
  rejection_reason TEXT,
  rejection_category TEXT CHECK (rejection_category IN ('tone', 'content', 'timing', 'strategy', 'personalization', 'other')),

  -- Edited content (if user edited before sending)
  edited_subject TEXT,
  edited_body TEXT,
  edited_by UUID REFERENCES auth.users(id),

  -- Send channel
  send_via TEXT DEFAULT 'gmail' CHECK (send_via IN ('gmail', 'outlook')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_approvals_user_status ON email_approvals(user_id, status);
CREATE INDEX idx_email_approvals_workspace ON email_approvals(workspace_id, status);
CREATE INDEX idx_email_approvals_pending ON email_approvals(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_email_approvals_agent ON email_approvals(agent_id);

-- RLS
ALTER TABLE email_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own approvals"
  ON email_approvals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own approvals"
  ON email_approvals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own approvals"
  ON email_approvals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own approvals"
  ON email_approvals FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_email_approvals_updated_at
  BEFORE UPDATE ON email_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE email_approvals IS 'AI-drafted emails pending human approval before sending';
COMMENT ON COLUMN email_approvals.rejection_category IS 'Category for AI training feedback';
COMMENT ON COLUMN email_approvals.context IS 'Why the AI agent drafted this email (trigger/reason)';
