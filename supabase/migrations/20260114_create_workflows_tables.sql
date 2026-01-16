-- Workflows Module Database Schema
-- AI-Powered Automation Engine

-- Main workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'error')),
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'contact_created', 'deal_stage_changed', 'email_received',
    'form_submitted', 'meeting_scheduled', 'task_completed'
  )),
  nodes JSONB NOT NULL DEFAULT '[]'::JSONB,
  edges JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_template BOOLEAN DEFAULT FALSE,
  total_executions INT DEFAULT 0,
  successful_executions INT DEFAULT 0,
  failed_executions INT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'processing_ai', 'waiting_approval', 'completed', 'failed', 'cancelled'
  )),
  trigger_data JSONB DEFAULT '{}'::JSONB,
  current_node_id UUID,
  execution_path JSONB DEFAULT '[]'::JSONB,
  node_outputs JSONB DEFAULT '{}'::JSONB,
  ai_tokens_used INT DEFAULT 0,
  ai_model_used VARCHAR(20),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Workflow drafts (emails awaiting approval)
CREATE TABLE IF NOT EXISTS public.workflow_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  draft_type VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (draft_type IN ('email', 'task', 'notification')),
  recipient_id UUID,
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON public.workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_drafts_execution ON public.workflow_drafts(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_drafts_status ON public.workflow_drafts(status);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows
CREATE POLICY "Users can view their own workflows" ON public.workflows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflows" ON public.workflows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows" ON public.workflows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows" ON public.workflows
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for workflow_executions
CREATE POLICY "Users can view executions of their workflows" ON public.workflow_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workflows
      WHERE workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert executions for their workflows" ON public.workflow_executions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflows
      WHERE workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_drafts
CREATE POLICY "Users can view drafts from their workflow executions" ON public.workflow_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_drafts.execution_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update drafts from their workflow executions" ON public.workflow_drafts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_drafts.execution_id
      AND w.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS workflow_updated_at ON public.workflows;
CREATE TRIGGER workflow_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();
