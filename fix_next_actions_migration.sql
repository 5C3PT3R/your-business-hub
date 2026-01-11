-- Fixed migration: Create next_actions table (handles existing policies)

-- Create table
CREATE TABLE IF NOT EXISTS next_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'email', 'call', 'meeting', 'follow_up', 'proposal',
    'contract', 'demo', 'qualify', 'nurture', 'rescue'
  )),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  urgency VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  ai_priority_score INT NOT NULL DEFAULT 50 CHECK (ai_priority_score >= 0 AND ai_priority_score <= 100),
  effort_minutes INT DEFAULT 15,
  revenue_impact DECIMAL(12, 2) DEFAULT 0,
  close_probability DECIMAL(5, 2) CHECK (close_probability >= 0 AND close_probability <= 100),
  due_date TIMESTAMPTZ,
  due_category VARCHAR(20) CHECK (due_category IN ('overdue', 'today', 'this_week', 'this_month', 'future')),
  ai_context JSONB DEFAULT '{}',
  ai_reasoning TEXT,
  ai_draft_content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'snoozed', 'skipped')),
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  source VARCHAR(50) DEFAULT 'ai' CHECK (source IN ('ai', 'user', 'workflow', 'system')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_next_actions_user_status ON next_actions(user_id, status, ai_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_next_actions_urgency ON next_actions(urgency, due_date);
CREATE INDEX IF NOT EXISTS idx_next_actions_deal ON next_actions(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_next_actions_contact ON next_actions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_next_actions_due_date ON next_actions(due_date) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE next_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view their own actions" ON next_actions;
CREATE POLICY "Users can view their own actions" ON next_actions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own actions" ON next_actions;
CREATE POLICY "Users can insert their own actions" ON next_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own actions" ON next_actions;
CREATE POLICY "Users can update their own actions" ON next_actions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own actions" ON next_actions;
CREATE POLICY "Users can delete their own actions" ON next_actions FOR DELETE USING (auth.uid() = user_id);

-- Create function for auto-categorizing due dates
CREATE OR REPLACE FUNCTION categorize_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_category := 'future';
  ELSIF NEW.due_date < NOW() THEN
    NEW.due_category := 'overdue';
  ELSIF NEW.due_date::date = CURRENT_DATE THEN
    NEW.due_category := 'today';
  ELSIF NEW.due_date < NOW() + INTERVAL '7 days' THEN
    NEW.due_category := 'this_week';
  ELSIF NEW.due_date < NOW() + INTERVAL '30 days' THEN
    NEW.due_category := 'this_month';
  ELSE
    NEW.due_category := 'future';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS categorize_next_actions_due_date ON next_actions;
CREATE TRIGGER categorize_next_actions_due_date
  BEFORE INSERT OR UPDATE OF due_date ON next_actions
  FOR EACH ROW
  EXECUTE FUNCTION categorize_due_date();

DROP TRIGGER IF EXISTS update_next_actions_updated_at ON next_actions;
CREATE TRIGGER update_next_actions_updated_at
  BEFORE UPDATE ON next_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
