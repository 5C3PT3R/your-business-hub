-- Day 4: Bishop Leads Table
-- This migration creates the exact schema required for Bishop sweep logic

-- Create the lead status enum (exact values from PRD)
DO $$ BEGIN
  CREATE TYPE public.bishop_lead_status AS ENUM (
    'INTRO_SENT',
    'FOLLOW_UP_NEEDED',
    'NUDGE_SENT',
    'BREAKUP_SENT',
    'ESCALATE_TO_KING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add Bishop-specific columns to leads table
-- These columns support the daily sweep logic

-- last_contact_date: When we last contacted this lead
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;

-- next_action_due: When Bishop should process this lead next
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;

-- notes: Append-only log of Bishop actions
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS notes TEXT;

-- bishop_status: The Bishop-specific status for sweep logic
-- This is separate from the existing 'status' column to avoid conflicts
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS bishop_status public.bishop_lead_status DEFAULT 'INTRO_SENT';

-- Index for the sweep query
CREATE INDEX IF NOT EXISTS idx_leads_bishop_sweep
ON public.leads(next_action_due, bishop_status)
WHERE next_action_due IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.leads.bishop_status IS 'Bishop agent status: INTRO_SENT, FOLLOW_UP_NEEDED, NUDGE_SENT, BREAKUP_SENT, ESCALATE_TO_KING';
COMMENT ON COLUMN public.leads.last_contact_date IS 'Timestamp of last contact with this lead';
COMMENT ON COLUMN public.leads.next_action_due IS 'When Bishop should next process this lead';
COMMENT ON COLUMN public.leads.notes IS 'Append-only log of Bishop actions and notes';
