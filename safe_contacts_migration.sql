-- Safe migration for contacts table updates
-- This version handles existing types and uses IF NOT EXISTS

-- Create lifecycle stage enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE lifecycle_stage AS ENUM ('lead', 'mql', 'sql', 'opportunity', 'customer', 'churned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing fields to contacts table (all use IF NOT EXISTS)
DO $$
BEGIN
    -- Add first_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='first_name') THEN
        ALTER TABLE contacts ADD COLUMN first_name TEXT;
    END IF;

    -- Add last_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='last_name') THEN
        ALTER TABLE contacts ADD COLUMN last_name TEXT;
    END IF;

    -- Add linkedin_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='linkedin_url') THEN
        ALTER TABLE contacts ADD COLUMN linkedin_url TEXT;
    END IF;

    -- Add lifecycle_stage if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lifecycle_stage') THEN
        ALTER TABLE contacts ADD COLUMN lifecycle_stage lifecycle_stage DEFAULT 'lead';
    END IF;

    -- Add lead_score if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_score') THEN
        ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
    END IF;

    -- Add email_verified if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='email_verified') THEN
        ALTER TABLE contacts ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;

    -- Add phone_valid if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='phone_valid') THEN
        ALTER TABLE contacts ADD COLUMN phone_valid BOOLEAN DEFAULT false;
    END IF;

    -- Add data_completeness if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='data_completeness') THEN
        ALTER TABLE contacts ADD COLUMN data_completeness INTEGER DEFAULT 0 CHECK (data_completeness >= 0 AND data_completeness <= 100);
    END IF;

    -- Add custom_fields if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='custom_fields') THEN
        ALTER TABLE contacts ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add tags if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='tags') THEN
        ALTER TABLE contacts ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    -- Add notes if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='notes') THEN
        ALTER TABLE contacts ADD COLUMN notes TEXT;
    END IF;

    -- Add last_activity_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='last_activity_at') THEN
        ALTER TABLE contacts ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add is_favorite if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='is_favorite') THEN
        ALTER TABLE contacts ADD COLUMN is_favorite BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Migrate existing name field to first_name/last_name
UPDATE contacts
SET first_name = SPLIT_PART(name, ' ', 1),
    last_name = CASE
      WHEN ARRAY_LENGTH(STRING_TO_ARRAY(name, ' '), 1) > 1
      THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
      ELSE ''
    END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Create indexes (using IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_contacts_search
ON contacts USING gin(
  to_tsvector('english',
    COALESCE(first_name, '') || ' ' ||
    COALESCE(last_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(company, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email_verified ON contacts(email_verified) WHERE email_verified = false;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_valid ON contacts(phone_valid) WHERE phone_valid = false;
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity ON contacts(last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON contacts(is_favorite) WHERE is_favorite = true;

-- Function to calculate data completeness score
CREATE OR REPLACE FUNCTION calculate_contact_completeness(contact_row contacts)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Required fields (10 points each)
  IF contact_row.first_name IS NOT NULL AND contact_row.first_name != '' THEN score := score + 10; END IF;
  IF contact_row.last_name IS NOT NULL AND contact_row.last_name != '' THEN score := score + 10; END IF;
  IF contact_row.email IS NOT NULL AND contact_row.email != '' THEN score := score + 10; END IF;

  -- Important fields (8 points each)
  IF contact_row.phone IS NOT NULL AND contact_row.phone != '' THEN score := score + 8; END IF;
  IF contact_row.company IS NOT NULL AND contact_row.company != '' THEN score := score + 8; END IF;
  IF contact_row.position IS NOT NULL AND contact_row.position != '' THEN score := score + 8; END IF;

  -- Additional fields (6 points each)
  IF contact_row.linkedin_url IS NOT NULL AND contact_row.linkedin_url != '' THEN score := score + 6; END IF;
  IF contact_row.avatar_url IS NOT NULL AND contact_row.avatar_url != '' THEN score := score + 6; END IF;

  -- Verification fields (10 points each)
  IF contact_row.email_verified = true THEN score := score + 10; END IF;
  IF contact_row.phone_valid = true THEN score := score + 10; END IF;

  -- Tags and notes (4 points each)
  IF contact_row.tags IS NOT NULL AND ARRAY_LENGTH(contact_row.tags, 1) > 0 THEN score := score + 4; END IF;
  IF contact_row.notes IS NOT NULL AND contact_row.notes != '' THEN score := score + 4; END IF;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function for trigger
CREATE OR REPLACE FUNCTION update_contact_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_completeness := calculate_contact_completeness(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_update_contact_completeness ON contacts;
CREATE TRIGGER trigger_update_contact_completeness
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_completeness();

-- Update existing records with completeness scores
UPDATE contacts SET updated_at = COALESCE(updated_at, NOW());

-- Create or replace view for contact list with computed fields
-- Note: Only joins tables/columns that exist
CREATE OR REPLACE VIEW contacts_with_stats AS
SELECT
  c.*,
  COUNT(DISTINCT d.id) as deal_count,
  0 as activity_count,
  0 as task_count,
  NULL::timestamp with time zone as latest_activity_at
FROM contacts c
LEFT JOIN deals d ON d.contact_id = c.id
GROUP BY c.id;

-- Grant permissions
GRANT SELECT ON contacts_with_stats TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN contacts.lifecycle_stage IS 'Contact lifecycle: lead → mql → sql → opportunity → customer';
COMMENT ON COLUMN contacts.lead_score IS 'AI-calculated score 0-100 based on engagement and fit';
COMMENT ON COLUMN contacts.data_completeness IS 'Auto-calculated completeness percentage 0-100';
COMMENT ON COLUMN contacts.email_verified IS 'Email validation status (NeverBounce)';
COMMENT ON COLUMN contacts.phone_valid IS 'Phone validation status (Twilio Lookup)';
COMMENT ON COLUMN contacts.custom_fields IS 'Flexible JSON storage for user-defined fields';
COMMENT ON COLUMN contacts.tags IS 'Array of tags for categorization';
