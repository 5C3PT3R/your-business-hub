-- Intelligent Notification Center Tables
-- AI-processed notifications with suggested next actions

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Notification type and source
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'deal_update', 'task_due', 'lead_activity', 'mention',
    'ai_insight', 'system', 'team_update', 'goal_progress',
    'contact_activity', 'email_received', 'meeting_reminder'
  )),
  source VARCHAR(50), -- 'system', 'ai_agent', 'user', 'integration'

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- AI Processing
  ai_summary TEXT, -- AI-generated concise summary
  ai_priority VARCHAR(20) CHECK (ai_priority IN ('critical', 'high', 'medium', 'low')),
  ai_suggested_actions JSONB DEFAULT '[]'::JSONB,
  -- Structure: [{ action: 'call_contact', label: 'Call John', params: { contact_id: '...' } }]

  -- Related entities
  related_entity_type VARCHAR(50), -- 'deal', 'contact', 'lead', 'task', 'company'
  related_entity_id UUID,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,

  -- Grouping for notification batching
  group_key VARCHAR(100), -- e.g., 'deal_123_updates' for grouping related notifications

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE AND is_archived = FALSE;
CREATE INDEX idx_notifications_user_workspace ON notifications(user_id, workspace_id, created_at DESC);
CREATE INDEX idx_notifications_priority ON notifications(ai_priority, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);
CREATE INDEX idx_notifications_related ON notifications(related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_group ON notifications(group_key) WHERE group_key IS NOT NULL;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications for users"
  ON notifications FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM auth.users
    )
  );

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- Notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Type preferences (which types to receive)
  enabled_types TEXT[] DEFAULT ARRAY['deal_update', 'task_due', 'lead_activity', 'mention', 'ai_insight', 'system', 'team_update', 'goal_progress', 'contact_activity', 'email_received', 'meeting_reminder'],

  -- AI preferences
  ai_summarization_enabled BOOLEAN DEFAULT TRUE,
  ai_priority_enabled BOOLEAN DEFAULT TRUE,
  ai_suggestions_enabled BOOLEAN DEFAULT TRUE,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- Batching preferences
  batch_notifications BOOLEAN DEFAULT FALSE,
  batch_frequency VARCHAR(20) DEFAULT 'instant' CHECK (batch_frequency IN ('instant', 'hourly', 'daily')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Trigger for preferences updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();
