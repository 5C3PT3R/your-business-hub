-- Add AI deal health scoring and tracking fields to deals table

-- Add new columns for deal health
ALTER TABLE deals ADD COLUMN IF NOT EXISTS health_score INT CHECK (health_score >= 0 AND health_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS health_category VARCHAR(20) CHECK (health_category IN ('critical', 'at_risk', 'healthy', 'excellent'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS days_since_contact INT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS champion_engaged BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS decision_maker_engaged BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS competitor_mentioned TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS buying_signals JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_forecast_close_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_win_probability DECIMAL(5, 2) CHECK (ai_win_probability >= 0 AND ai_win_probability <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sentiment_trend VARCHAR(20) CHECK (sentiment_trend IN ('improving', 'stable', 'declining'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS engagement_score INT CHECK (engagement_score >= 0 AND engagement_score <= 100);

-- Create index for health queries
CREATE INDEX IF NOT EXISTS idx_deals_health_score ON deals(health_score DESC) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_days_since_contact ON deals(days_since_contact) WHERE days_since_contact IS NOT NULL;

-- Function to auto-categorize health score
CREATE OR REPLACE FUNCTION categorize_deal_health()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.health_score IS NULL THEN
    NEW.health_category := NULL;
  ELSIF NEW.health_score >= 80 THEN
    NEW.health_category := 'excellent';
  ELSIF NEW.health_score >= 60 THEN
    NEW.health_category := 'healthy';
  ELSIF NEW.health_score >= 40 THEN
    NEW.health_category := 'at_risk';
  ELSE
    NEW.health_category := 'critical';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categorize_deal_health_score
  BEFORE INSERT OR UPDATE OF health_score ON deals
  FOR EACH ROW
  EXECUTE FUNCTION categorize_deal_health();

-- Function to calculate days since contact
CREATE OR REPLACE FUNCTION calculate_days_since_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_contact_date IS NOT NULL THEN
    NEW.days_since_contact := EXTRACT(DAY FROM (NOW() - NEW.last_contact_date));
  ELSE
    NEW.days_since_contact := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_deal_days_since_contact
  BEFORE INSERT OR UPDATE OF last_contact_date ON deals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_days_since_contact();

-- Comments
COMMENT ON COLUMN deals.health_score IS 'AI-calculated deal health score (0-100): engagement, sentiment, time, stakeholders';
COMMENT ON COLUMN deals.buying_signals IS 'Array of positive buying signals detected by AI';
COMMENT ON COLUMN deals.risk_factors IS 'Array of risk factors detected by AI';
COMMENT ON COLUMN deals.ai_win_probability IS 'AI-predicted probability of winning this deal (0-100%)';
