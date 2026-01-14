-- Seed pre-built agent templates for AI Agents module
-- These templates can be cloned by users to create their own agents

-- Template 1: Receptionist Agent
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'Receptionist Agent',
  'Routes conversations, captures lead information, and qualifies initial inquiries. Perfect for handling inbound questions and directing them to the right team member.',
  'receptionist',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "friendly",
      "style": "concise",
      "greeting": "Hi! How can I help you today?"
    },
    "capabilities": {
      "can_answer": true,
      "can_collect": true,
      "can_update": true,
      "can_book": false,
      "can_send": false
    },
    "channels": ["webchat", "email"],
    "agent_specific": {
      "qualification_questions": [
        "What brings you here today?",
        "What is your company name?",
        "What is your role?"
      ],
      "routing_rules": {
        "sales_inquiry": "route_to_sdr",
        "support_request": "route_to_support",
        "general_question": "self_serve"
      }
    }
  }'::JSONB,
  'manual',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Template 2: SDR Agent - BANT Qualifier
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'SDR Agent - BANT Qualifier',
  'Qualifies inbound leads using the BANT framework (Budget, Authority, Need, Timeline) and automatically books discovery calls with qualified prospects.',
  'sdr',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "professional",
      "style": "detailed",
      "greeting": "Thanks for your interest! I have a few quick questions to make sure we can help."
    },
    "capabilities": {
      "can_answer": true,
      "can_collect": true,
      "can_update": true,
      "can_book": true,
      "can_send": true
    },
    "channels": ["email", "linkedin"],
    "agent_specific": {
      "qualification_framework": "BANT",
      "bant_criteria": {
        "budget": {
          "required": true,
          "min_threshold": 10000
        },
        "authority": {
          "required": true,
          "decision_maker_roles": ["VP", "Director", "C-Level", "Head of", "Chief"]
        },
        "need": {
          "required": true
        },
        "timeline": {
          "required": true,
          "max_days": 90
        }
      },
      "auto_qualify_threshold": 3,
      "booking_instructions": "Book a 30-minute discovery call to discuss your needs"
    }
  }'::JSONB,
  'manual',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Template 3: Deal Health Monitor
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'Deal Health Monitor',
  'Continuously monitors deal health, calculates health scores based on engagement, and automatically flags at-risk opportunities that need attention.',
  'deal_analyst',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "professional",
      "style": "detailed"
    },
    "capabilities": {
      "can_answer": false,
      "can_collect": false,
      "can_update": true,
      "can_book": false,
      "can_send": false
    },
    "channels": [],
    "agent_specific": {
      "health_factors": {
        "engagement_score": {
          "weight": 0.3,
          "description": "Frequency and quality of interactions"
        },
        "days_since_contact": {
          "weight": 0.2,
          "threshold_days": 7
        },
        "stage_velocity": {
          "weight": 0.25,
          "description": "Time spent in each stage vs expected"
        },
        "stakeholder_coverage": {
          "weight": 0.15,
          "description": "Number of contacts engaged"
        },
        "competitive_pressure": {
          "weight": 0.1,
          "description": "Mentions of competitors"
        }
      },
      "risk_thresholds": {
        "critical": 30,
        "at_risk": 60,
        "healthy": 80
      },
      "auto_flag_at_risk": true,
      "notify_rep": true
    }
  }'::JSONB,
  'hourly',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Template 4: Marketing ROI Analyzer
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'Marketing ROI Analyzer',
  'Analyzes marketing campaign performance, tracks multi-touch attribution, and identifies which channels drive the most revenue.',
  'marketing_analyst',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "professional",
      "style": "detailed"
    },
    "capabilities": {
      "can_answer": true,
      "can_collect": false,
      "can_update": false,
      "can_book": false,
      "can_send": false
    },
    "channels": ["email"],
    "agent_specific": {
      "attribution_model": "multi_touch",
      "metrics_tracked": [
        "lead_source_conversion",
        "campaign_roi",
        "cost_per_lead",
        "cost_per_acquisition",
        "lead_to_customer_rate",
        "pipeline_influenced",
        "revenue_influenced"
      ],
      "report_frequency": "weekly",
      "alert_on_anomalies": true,
      "anomaly_threshold": 0.3
    }
  }'::JSONB,
  'daily',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Template 5: Smart Follow-Up Agent
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'Smart Follow-Up Agent',
  'Drafts personalized follow-up emails based on conversation context, deal stage, and prospect behavior. Maintains consistent communication with your pipeline.',
  'follow_up',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "friendly",
      "style": "concise"
    },
    "capabilities": {
      "can_answer": false,
      "can_collect": false,
      "can_update": false,
      "can_book": false,
      "can_send": true
    },
    "channels": ["email", "linkedin"],
    "agent_specific": {
      "email_scenarios": {
        "post_demo": {
          "delay_days": 1,
          "template_style": "recap_and_next_steps"
        },
        "check_in": {
          "delay_days": 7,
          "template_style": "value_add_content"
        },
        "re_engagement": {
          "delay_days": 14,
          "template_style": "new_feature_or_case_study"
        },
        "closing": {
          "delay_days": 3,
          "template_style": "address_concerns"
        }
      },
      "personalization_fields": [
        "recent_conversation_summary",
        "deal_stage",
        "pain_points_mentioned",
        "next_best_action",
        "company_news"
      ],
      "auto_send": false,
      "require_approval": true,
      "follow_up_delay_days": 3
    }
  }'::JSONB,
  'daily',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Template 6: Sales Coach Agent
INSERT INTO agents (
  name,
  description,
  agent_type,
  is_template,
  status,
  config,
  schedule_type,
  user_id,
  workspace_id
) VALUES (
  'Sales Coach Agent',
  'Analyzes individual and team performance, identifies coaching opportunities, and provides data-driven feedback to improve win rates and productivity.',
  'coach',
  TRUE,
  'inactive',
  '{
    "personality": {
      "tone": "friendly",
      "style": "detailed"
    },
    "capabilities": {
      "can_answer": true,
      "can_collect": false,
      "can_update": false,
      "can_book": false,
      "can_send": true
    },
    "channels": ["email"],
    "agent_specific": {
      "performance_metrics": [
        "win_rate",
        "avg_deal_size",
        "sales_velocity",
        "activity_levels",
        "conversation_quality",
        "pipeline_coverage",
        "forecast_accuracy"
      ],
      "coaching_focus_areas": [
        "discovery_questions",
        "objection_handling",
        "closing_techniques",
        "relationship_building",
        "product_knowledge",
        "competitive_positioning"
      ],
      "feedback_frequency": "weekly",
      "anonymize_peer_comparisons": true,
      "coaching_format": "strengths_and_opportunities"
    }
  }'::JSONB,
  'weekly',
  (SELECT id FROM auth.users LIMIT 1),
  NULL
) ON CONFLICT DO NOTHING;

-- Note: workspace_id is NULL for templates as they are global/shared across workspaces
-- When a user clones a template, the new agent will have their workspace_id set
