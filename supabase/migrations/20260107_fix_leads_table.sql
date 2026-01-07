-- Add missing columns to leads table

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS company TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS if not already enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

CREATE POLICY "Users can view leads in their workspaces"
ON public.leads
FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create leads in their workspaces"
ON public.leads
FOR INSERT
WITH CHECK (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update leads in their workspaces"
ON public.leads
FOR UPDATE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete leads in their workspaces"
ON public.leads
FOR DELETE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
