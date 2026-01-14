-- Create agents table for AI Agents module
-- This stores persistent agent configurations that users create and manage

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  agent_type VARCHAR(50) NOT NULL CHECK (agent_type IN (
    'receptionist',
    'sdr',
    'deal_analyst',
    'marketing_analyst',
    'follow_up',
    'coach'
  )),

  -- Status Management
  status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN (
    'active',
    'inactive',
    'paused',
    'error'
  )),
  is_template BOOLEAN DEFAULT FALSE,

  -- Configuration (JSONB for flexibility across different agent types)
  -- Structure: {
  --   "personality": {"tone": "professional|friendly|casual", "style": "concise|detailed", "greeting": "..."},
  --   "capabilities": {"can_answer": true, "can_collect": true, "can_update": true, "can_book": false, "can_send": false},
  --   "channels": ["email", "linkedin", "whatsapp", "webchat"],
  --   "knowledge_base": {"files": ["..."], "urls": ["..."]},
  --   "handoff_rules": {"trigger_conditions": ["..."], "handoff_to_user_id": "uuid"},
  --   "agent_specific": {...} -- Type-specific configuration
  -- }
  config JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Scheduling
  schedule_type VARCHAR(20) DEFAULT 'manual' CHECK (schedule_type IN (
    'manual',
    'continuous',
    'hourly',
    'daily',
    'weekly'
  )),
  schedule_config JSONB DEFAULT '{}'::JSONB,

  -- Execution Tracking
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_executions INT DEFAULT 0,
  successful_executions INT DEFAULT 0,
  failed_executions INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_workspace_status ON agents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_next_run ON agents(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agents_templates ON agents(is_template) WHERE is_template = TRUE;

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view agents in their workspaces OR template agents
CREATE POLICY "Users can view agents in their workspaces"
  ON agents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR is_template = TRUE
  );

-- RLS Policy: Users can create agents in their workspaces
CREATE POLICY "Users can create agents in their workspaces"
  ON agents FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update agents in their workspaces
CREATE POLICY "Users can update agents in their workspaces"
  ON agents FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete agents in their workspaces
CREATE POLICY "Users can delete agents in their workspaces"
  ON agents FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create agent_executions table for execution history and logging
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Execution Details
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'running',
    'completed',
    'failed',
    'cancelled'
  )),
  trigger_type VARCHAR(30) CHECK (trigger_type IN (
    'manual',
    'scheduled',
    'event',
    'api'
  )),

  -- Action Results
  actions_planned INT DEFAULT 0,
  actions_executed INT DEFAULT 0,
  actions_failed INT DEFAULT 0,

  -- Execution Data (JSONB for flexible storage)
  input_context JSONB DEFAULT '{}'::JSONB,
  planned_actions JSONB DEFAULT '[]'::JSONB,
  execution_results JSONB DEFAULT '[]'::JSONB,

  -- Performance Metrics
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Error Tracking
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for agent_executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_workspace ON agent_executions(workspace_id, created_at DESC);

-- Enable Row Level Security for agent_executions
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view executions in their workspaces
CREATE POLICY "Users can view executions in their workspaces"
  ON agent_executions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert executions (for manual triggers)
CREATE POLICY "Users can insert executions in their workspaces"
  ON agent_executions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE agents IS 'Stores persistent AI agent configurations that users create and manage';
COMMENT ON TABLE agent_executions IS 'Logs execution history for all agent runs';
COMMENT ON COLUMN agents.config IS 'JSONB configuration including personality, capabilities, channels, knowledge base, and handoff rules';
COMMENT ON COLUMN agents.is_template IS 'TRUE for pre-built templates, FALSE for user-created agents';
COMMENT ON COLUMN agent_executions.input_context IS 'Context provided to agent at execution time (deals, contacts, etc.)';
COMMENT ON COLUMN agent_executions.planned_actions IS 'Array of actions the agent planned to take';
COMMENT ON COLUMN agent_executions.execution_results IS 'Results of executing planned actions';
