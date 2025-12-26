-- Add ai_processed column to activities table
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS ai_processed boolean DEFAULT false;