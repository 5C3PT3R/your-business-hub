-- Step 1: Update existing deals to map to closest new stage
UPDATE public.deals SET stage = 'proposal' WHERE stage = 'discovery';
UPDATE public.deals SET stage = 'proposal' WHERE stage = 'negotiation';
UPDATE public.deals SET stage = 'proposal' WHERE stage = 'contract';
UPDATE public.deals SET stage = 'closed_won' WHERE stage = 'closed_won';
UPDATE public.deals SET stage = 'closed_lost' WHERE stage = 'closed_lost';

-- Step 2: Create new enum type with 4 stages
CREATE TYPE public.deal_stage_v2 AS ENUM ('lead', 'qualified', 'proposal', 'closed');

-- Step 3: Alter the deals table to use new enum
ALTER TABLE public.deals 
  ALTER COLUMN stage DROP DEFAULT,
  ALTER COLUMN stage TYPE public.deal_stage_v2 
    USING (
      CASE stage::text
        WHEN 'discovery' THEN 'lead'::public.deal_stage_v2
        WHEN 'proposal' THEN 'proposal'::public.deal_stage_v2
        WHEN 'negotiation' THEN 'qualified'::public.deal_stage_v2
        WHEN 'contract' THEN 'proposal'::public.deal_stage_v2
        WHEN 'closed_won' THEN 'closed'::public.deal_stage_v2
        WHEN 'closed_lost' THEN 'closed'::public.deal_stage_v2
        ELSE 'lead'::public.deal_stage_v2
      END
    ),
  ALTER COLUMN stage SET DEFAULT 'lead'::public.deal_stage_v2;

-- Step 4: Drop old enum and rename new one
DROP TYPE public.deal_stage;
ALTER TYPE public.deal_stage_v2 RENAME TO deal_stage;

-- Step 5: Add missing columns to activities table
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS ai_summary text;