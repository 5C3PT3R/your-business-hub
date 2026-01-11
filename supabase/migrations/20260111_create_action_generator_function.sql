-- Function to generate Next Actions from existing CRM data
-- Call this function to create AI-prioritized actions from your deals, contacts, and leads

CREATE OR REPLACE FUNCTION generate_next_actions_from_crm_data()
RETURNS TABLE (
  actions_created INTEGER,
  message TEXT
) AS $$
DECLARE
  actions_count INTEGER := 0;
BEGIN

  -- 1. Generate follow-up actions for deals with no recent activity
  INSERT INTO next_actions (
    user_id,
    workspace_id,
    deal_id,
    title,
    description,
    action_type,
    urgency,
    ai_priority_score,
    effort_minutes,
    revenue_impact,
    due_date,
    ai_context,
    ai_reasoning,
    status,
    source
  )
  SELECT
    d.user_id,
    d.workspace_id,
    d.id,
    'Follow up on ' || COALESCE(d.title, 'deal'),
    'No recent activity. Time to re-engage and move forward.',
    'follow_up',
    CASE
      WHEN d.updated_at < NOW() - INTERVAL '7 days' THEN 'critical'
      WHEN d.updated_at < NOW() - INTERVAL '3 days' THEN 'high'
      ELSE 'medium'
    END,
    CASE
      WHEN d.value > 50000 AND d.updated_at < NOW() - INTERVAL '7 days' THEN 95
      WHEN d.value > 50000 THEN 85
      WHEN d.value > 25000 THEN 75
      ELSE 60
    END,
    15,
    COALESCE(d.value, 0),
    NOW() + INTERVAL '1 day',
    jsonb_build_object(
      'lastActivity', d.updated_at,
      'daysSinceUpdate', EXTRACT(DAY FROM (NOW() - d.updated_at)),
      'stage', d.stage
    ),
    'Deal needs follow-up based on inactivity period.',
    'pending',
    'ai'
  FROM deals d
  WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    AND d.updated_at < NOW() - INTERVAL '2 days'
    AND NOT EXISTS (
      SELECT 1 FROM next_actions na
      WHERE na.deal_id = d.id
        AND na.status IN ('pending', 'in_progress')
        AND na.action_type = 'follow_up'
    )
  LIMIT 20;

  GET DIAGNOSTICS actions_count = ROW_COUNT;

  -- 2. Generate proposal actions for deals in demo stage
  INSERT INTO next_actions (
    user_id,
    workspace_id,
    deal_id,
    title,
    description,
    action_type,
    urgency,
    ai_priority_score,
    effort_minutes,
    revenue_impact,
    due_date,
    ai_context,
    ai_reasoning,
    status,
    source
  )
  SELECT
    d.user_id,
    d.workspace_id,
    d.id,
    'Send proposal to ' || COALESCE(d.title, 'prospect'),
    'Demo stage - time to send proposal and move to close.',
    'proposal',
    'high',
    CASE
      WHEN d.value > 50000 THEN 90
      WHEN d.value > 25000 THEN 80
      ELSE 70
    END,
    20,
    COALESCE(d.value, 0),
    NOW() + INTERVAL '2 days',
    jsonb_build_object(
      'stage', d.stage,
      'value', d.value
    ),
    'Deal is in demo stage. Next logical step is to send proposal.',
    'pending',
    'ai'
  FROM deals d
  WHERE LOWER(d.stage) LIKE '%demo%'
    AND NOT EXISTS (
      SELECT 1 FROM next_actions na
      WHERE na.deal_id = d.id
        AND na.status IN ('pending', 'in_progress')
        AND na.action_type = 'proposal'
    )
  LIMIT 10;

  GET DIAGNOSTICS actions_count = actions_count + ROW_COUNT;

  -- 3. Generate qualification actions for new leads
  INSERT INTO next_actions (
    user_id,
    workspace_id,
    lead_id,
    title,
    description,
    action_type,
    urgency,
    ai_priority_score,
    effort_minutes,
    revenue_impact,
    due_date,
    ai_context,
    ai_reasoning,
    status,
    source
  )
  SELECT
    l.user_id,
    l.workspace_id,
    l.id,
    'Qualify lead - ' || COALESCE(l.company, l.name, 'New Lead'),
    'New lead needs initial qualification call.',
    'qualify',
    CASE
      WHEN l.status = 'hot' THEN 'critical'
      WHEN l.status = 'warm' THEN 'high'
      ELSE 'medium'
    END,
    CASE
      WHEN l.status = 'hot' THEN 85
      WHEN l.status = 'warm' THEN 75
      ELSE 65
    END,
    20,
    COALESCE(l.value, 25000), -- Default estimated value
    NOW() + INTERVAL '1 day',
    jsonb_build_object(
      'status', l.status,
      'source', l.source,
      'createdAt', l.created_at
    ),
    'New lead requires qualification to assess fit and priority.',
    'pending',
    'ai'
  FROM leads l
  WHERE l.status IN ('new', 'contacted', 'hot', 'warm')
    AND l.created_at > NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM next_actions na
      WHERE na.lead_id = l.id
        AND na.status IN ('pending', 'in_progress')
        AND na.action_type = 'qualify'
    )
  LIMIT 15;

  GET DIAGNOSTICS actions_count = actions_count + ROW_COUNT;

  -- 4. Generate call actions for contacts with high engagement
  INSERT INTO next_actions (
    user_id,
    workspace_id,
    contact_id,
    title,
    description,
    action_type,
    urgency,
    ai_priority_score,
    effort_minutes,
    revenue_impact,
    due_date,
    ai_context,
    ai_reasoning,
    status,
    source
  )
  SELECT
    c.user_id,
    c.workspace_id,
    c.id,
    'Call ' || COALESCE(c.name, 'contact'),
    'Reach out to maintain relationship and explore opportunities.',
    'call',
    'medium',
    60,
    15,
    15000, -- Estimated potential
    NOW() + INTERVAL '3 days',
    jsonb_build_object(
      'company', c.company,
      'phone', c.phone
    ),
    'Regular touchpoint to maintain relationship.',
    'pending',
    'ai'
  FROM contacts c
  WHERE c.phone IS NOT NULL
    AND c.updated_at < NOW() - INTERVAL '14 days'
    AND NOT EXISTS (
      SELECT 1 FROM next_actions na
      WHERE na.contact_id = c.id
        AND na.status IN ('pending', 'in_progress')
        AND na.created_at > NOW() - INTERVAL '7 days'
    )
  LIMIT 10;

  GET DIAGNOSTICS actions_count = actions_count + ROW_COUNT;

  -- Return summary
  RETURN QUERY SELECT
    actions_count,
    'Generated ' || actions_count || ' next actions from existing CRM data.' as message;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_next_actions_from_crm_data() TO authenticated;

-- Comment
COMMENT ON FUNCTION generate_next_actions_from_crm_data() IS 'Generates AI-prioritized next actions from existing deals, leads, and contacts';
