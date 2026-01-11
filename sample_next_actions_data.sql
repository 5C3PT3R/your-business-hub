-- Sample data for Next Actions
-- Run this AFTER the migration to see data in the page

-- Note: Replace 'YOUR_USER_ID' with your actual user ID from auth.users table
-- To find your user ID, run: SELECT id FROM auth.users WHERE email = 'your@email.com';

-- Sample Action 1: Critical - Rescue Acme Corp deal
INSERT INTO next_actions (
  user_id,
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
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Gets first user
  'Rescue Acme Corp deal',
  'Champion ghosting for 6 days, competitor mentioned, close date Friday',
  'rescue',
  'critical',
  95,
  30,
  50000.00,
  42.00,
  NOW() + INTERVAL '2 days',
  '{"lastMessage": "We are evaluating options", "sentimentTrend": "negative", "competitors": ["Salesforce"], "risks": ["Champion not responding", "Competitor mentioned"], "decisionTimeline": "Friday (3 days!)", "championStatus": "ghosting"}',
  'This deal is at critical risk. The champion has been unresponsive for 6 days, a competitor was mentioned, and the close date is in 3 days. Immediate action required.',
  'pending',
  'ai'
);

-- Sample Action 2: High - Follow up TechCo demo
INSERT INTO next_actions (
  user_id,
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
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Follow up TechCo demo',
  'Demo was 2 days ago, send proposal as discussed',
  'proposal',
  'high',
  88,
  15,
  75000.00,
  78.00,
  NOW(),
  '{"lastMessage": "Great demo, send us a proposal", "sentimentTrend": "positive", "buyingSignals": ["Asked for pricing", "Mentioned budget approved"], "championStatus": "engaged"}',
  'High-intent lead. Positive demo feedback and explicit request for proposal. Strike while hot!',
  'pending',
  'ai'
);

-- Sample Action 3: High - Qualify new lead BigCo
INSERT INTO next_actions (
  user_id,
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
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Qualify new lead - BigCo',
  'High intent score (92/100), multiple pages viewed',
  'qualify',
  'high',
  85,
  20,
  100000.00,
  65.00,
  NOW(),
  '{"buyingSignals": ["Viewed pricing 3 times", "Downloaded case study", "VP title"]}',
  'High-intent new lead with multiple buying signals. VP-level contact. Call now while engaged.',
  'pending',
  'ai'
);

-- Sample Action 4: Medium - Send contract to SmallCo
INSERT INTO next_actions (
  user_id,
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
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Send contract to SmallCo',
  'Verbal agreement received, ready to close',
  'contract',
  'medium',
  75,
  10,
  25000.00,
  90.00,
  NOW() + INTERVAL '1 day',
  '{"lastMessage": "Yes, let us proceed", "sentimentTrend": "positive", "buyingSignals": ["Verbal commitment", "Decision maker engaged"], "championStatus": "engaged"}',
  'Deal is ready to close. Just need to send the contract.',
  'pending',
  'user'
);

-- Sample Action 5: Medium - Schedule demo with MidCo
INSERT INTO next_actions (
  user_id,
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
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Schedule demo with MidCo',
  'Requested demo after pricing page visit',
  'demo',
  'medium',
  70,
  15,
  60000.00,
  55.00,
  NOW() + INTERVAL '3 days',
  '{"buyingSignals": ["Requested demo", "Engaged with pricing page"], "championStatus": "engaged"}',
  'Lead requested demo. High-value opportunity, schedule within 48 hours.',
  'pending',
  'ai'
);

-- Sample completed action
INSERT INTO next_actions (
  user_id,
  title,
  description,
  action_type,
  urgency,
  ai_priority_score,
  effort_minutes,
  revenue_impact,
  close_probability,
  due_date,
  status,
  completed_at,
  source
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Send proposal to TestCorp',
  'Follow up on demo from last week',
  'proposal',
  'high',
  80,
  20,
  45000.00,
  70.00,
  NOW() - INTERVAL '1 day',
  'completed',
  NOW() - INTERVAL '2 hours',
  'user'
);

-- Verify insertion
SELECT
  id,
  title,
  urgency,
  status,
  ai_priority_score,
  revenue_impact
FROM next_actions
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY ai_priority_score DESC;
