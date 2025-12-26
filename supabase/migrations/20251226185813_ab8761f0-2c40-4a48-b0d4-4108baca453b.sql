-- Add at_risk and stage tracking fields to deals table for AI agents
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS at_risk boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stage_changed_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS ai_stage_suggestion text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS follow_up_completed boolean DEFAULT false;

-- Add index for faster queries on at_risk deals
CREATE INDEX IF NOT EXISTS idx_deals_at_risk ON public.deals (at_risk) WHERE at_risk = true;

-- Create trigger to track stage changes
CREATE OR REPLACE FUNCTION public.track_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for stage tracking
DROP TRIGGER IF EXISTS deal_stage_change_trigger ON public.deals;
CREATE TRIGGER deal_stage_change_trigger
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.track_deal_stage_change();