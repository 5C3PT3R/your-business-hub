-- Create ai_insights table for AI-discovered patterns and recommendations
-- Powers the AI Insights widget on Dashboard

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Insight details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN (
    'pattern', 'anomaly', 'recommendation', 'warning',
    'opportunity', 'risk', 'trend', 'prediction'
  )),

  -- Category
  category VARCHAR(50) CHECK (category IN (
    'deal_health', 'content_performance', 'timing', 'engagement',
    'conversion', 'churn_risk', 'upsell', 'competitor'
  )),

  -- Impact
  impact_level VARCHAR(20) DEFAULT 'medium' CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
  confidence_score DECIMAL(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Data supporting the insight
  data_points JSONB DEFAULT '{}', -- Statistical data, counts, percentages
  affected_entities JSONB DEFAULT '{}', -- Deals, contacts, campaigns affected

  -- AI analysis
  ai_reasoning TEXT, -- Why this insight matters
  recommended_actions JSONB DEFAULT '[]', -- Array of suggested actions

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acted_on', 'dismissed', 'archived')),
  acted_on_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Discovery
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_method VARCHAR(50) DEFAULT 'ai_analysis',

  -- Visibility
  shown_to_users UUID[] DEFAULT '{}', -- Users who have seen this
  is_visible BOOLEAN DEFAULT TRUE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_workspace ON ai_insights(workspace_id, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type, impact_level);
CREATE INDEX IF NOT EXISTS idx_ai_insights_status ON ai_insights(status, is_visible);

-- Enable RLS
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view insights for their workspace"
  ON ai_insights FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert insights"
  ON ai_insights FOR INSERT
  WITH CHECK (true); -- Allow system/service role to insert

CREATE POLICY "Users can update insights in their workspace"
  ON ai_insights FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON ai_insights;
CREATE TRIGGER update_ai_insights_updated_at
  BEFORE UPDATE ON ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE ai_insights IS 'AI-discovered patterns, trends, and recommendations shown on Dashboard';
COMMENT ON COLUMN ai_insights.confidence_score IS 'AI confidence in this insight (0-100%)';
COMMENT ON COLUMN ai_insights.data_points IS 'Statistical data supporting the insight (counts, percentages, trends)';
