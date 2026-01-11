-- Generate Next Actions from existing CRM data
-- This creates AI-prioritized actions based on your existing deals, contacts, and leads

-- 1. Create actions for deals without recent activity (at-risk)
INSERT INTO next_actions (
  user_id,
  workspace_id,
  contact_id,
  deal_id,
  title,
  description,
  action_type,
  urgency,
  ai_priority_score,
  effort_minutes,
  revenue_impact,
  close_probability,
  due_date,
  ai_context,
  ai_reasoning,
  status,
  source
)
SELECT
  d.user_id,
  d.workspace_id,
  'Follow up on ' || COALESCE(d.title, 'Untitled Deal'),
  'No recent activity on this deal. Follow up to keep momentum.',
  'follow_up',
  CASE
    WHEN d.stage = 'closed-won' THEN 'low'
    WHEN d.stage = 'closed-lost' THEN 'low'
    WHEN d.updated_at < NOW() - INTERVAL '7 days' THEN 'critical'
    WHEN d.updated_at < NOW() + INTERVAL '3 days' THEN 'high'
    ELSE 'medium'
  END,
  CASE
    WHEN d.value > 50000 THEN 90
    WHEN d.value > 25000 THEN 75
    ELSE 60
  END,
  15, -- effort_minutes
  d.value,
  NULL, -- close_probability
  NOW() + INTERVAL '1 day',
  '{}',
  'This deal needs attention based on recent activity.',
  'pending',
  'ai'
FROM deals d
WHERE d.stage NOT IN ('closed_won', 'closed_lost')
AND NOT EXISTS (
  SELECT 1 FROM next_actions na
  WHERE na.deal_id = d.id AND na.status = 'pending'
)
LIMIT 10;

-- Verify the actions were created
SELECT
  id,
  title,
  urgency,
  status,
  ai_priority_score,
  revenue_impact,
  created_at
FROM next_actions
WHERE user_id = auth.uid()
ORDER BY ai_priority_score DESC;
