-- Enhancement: Add AI-powered deal intelligence fields
-- Based on Breeze CRM PRD Section 3.1

-- Add new columns to deals table for AI intelligence
DO $$
BEGIN
  -- Health Score (0-100, AI calculated)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='health_score'
  ) THEN
    ALTER TABLE deals ADD COLUMN health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100);
  END IF;

  -- Days in current stage (calculated field)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='days_in_stage'
  ) THEN
    ALTER TABLE deals ADD COLUMN days_in_stage INTEGER DEFAULT 0;
  END IF;

  -- Last activity timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='last_activity_at'
  ) THEN
    ALTER TABLE deals ADD COLUMN last_activity_at TIMESTAMPTZ;
  END IF;

  -- Stage entered timestamp (for calculating days_in_stage)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='stage_entered_at'
  ) THEN
    ALTER TABLE deals ADD COLUMN stage_entered_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Lost reason (required if stage = lost)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='lost_reason'
  ) THEN
    ALTER TABLE deals ADD COLUMN lost_reason TEXT;
  END IF;

  -- Owner/assigned user
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='owner_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;

  -- Company logo URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='company_logo_url'
  ) THEN
    ALTER TABLE deals ADD COLUMN company_logo_url TEXT;
  END IF;

  -- AI Analysis fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='ai_risk_factors'
  ) THEN
    ALTER TABLE deals ADD COLUMN ai_risk_factors TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='ai_next_actions'
  ) THEN
    ALTER TABLE deals ADD COLUMN ai_next_actions TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='deals' AND column_name='sentiment_trend'
  ) THEN
    ALTER TABLE deals ADD COLUMN sentiment_trend VARCHAR(20) CHECK (sentiment_trend IN ('positive', 'neutral', 'negative'));
  END IF;
END $$;

-- Create index on health_score for filtering
CREATE INDEX IF NOT EXISTS idx_deals_health_score ON deals(health_score DESC);

-- Create index on stage_entered_at for calculating days_in_stage
CREATE INDEX IF NOT EXISTS idx_deals_stage_entered ON deals(stage_entered_at DESC);

-- Function to automatically update days_in_stage
CREATE OR REPLACE FUNCTION update_deal_days_in_stage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_in_stage := EXTRACT(DAY FROM (NOW() - NEW.stage_entered_at))::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update days_in_stage on every update
DROP TRIGGER IF EXISTS trigger_update_deal_days_in_stage ON deals;
CREATE TRIGGER trigger_update_deal_days_in_stage
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_days_in_stage();

-- Function to reset stage_entered_at when stage changes
CREATE OR REPLACE FUNCTION reset_stage_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage != OLD.stage THEN
    NEW.stage_entered_at := NOW();
    NEW.days_in_stage := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reset stage timestamp when stage changes
DROP TRIGGER IF EXISTS trigger_reset_stage_entered_at ON deals;
CREATE TRIGGER trigger_reset_stage_entered_at
  BEFORE UPDATE OF stage ON deals
  FOR EACH ROW
  EXECUTE FUNCTION reset_stage_entered_at();

-- Update existing deals to set default values
UPDATE deals
SET
  health_score = 50,
  days_in_stage = EXTRACT(DAY FROM (NOW() - created_at))::INTEGER,
  stage_entered_at = created_at,
  owner_id = user_id
WHERE health_score IS NULL OR stage_entered_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN deals.health_score IS 'AI-calculated deal health score (0-100). Updated by background job.';
COMMENT ON COLUMN deals.days_in_stage IS 'Number of days deal has been in current stage. Auto-calculated.';
COMMENT ON COLUMN deals.ai_risk_factors IS 'Array of AI-detected risk factors (e.g., "Ghosting detected", "Competitor mentioned")';
COMMENT ON COLUMN deals.ai_next_actions IS 'AI-suggested next steps to advance the deal';
COMMENT ON COLUMN deals.sentiment_trend IS 'Overall sentiment trend from recent interactions';
