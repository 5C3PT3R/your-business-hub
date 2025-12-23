-- Add unique constraint to prevent duplicate workspaces per user per industry type
ALTER TABLE public.workspaces 
ADD CONSTRAINT unique_owner_industry UNIQUE (owner_id, industry_type);