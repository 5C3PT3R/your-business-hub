-- Add workspace_id columns to existing tables

-- Add workspace_id to deals table
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to activities table
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to leads table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update RLS policies for deals to include workspace context
DROP POLICY IF EXISTS "Users can view their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can create their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON public.deals;

CREATE POLICY "Users can view deals in their workspaces"
ON public.deals
FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create deals in their workspaces"
ON public.deals
FOR INSERT
WITH CHECK (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update deals in their workspaces"
ON public.deals
FOR UPDATE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete deals in their workspaces"
ON public.deals
FOR DELETE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Update RLS policies for contacts to include workspace context
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

CREATE POLICY "Users can view contacts in their workspaces"
ON public.contacts
FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contacts in their workspaces"
ON public.contacts
FOR INSERT
WITH CHECK (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contacts in their workspaces"
ON public.contacts
FOR UPDATE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete contacts in their workspaces"
ON public.contacts
FOR DELETE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Update RLS policies for tasks to include workspace context
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their workspaces"
ON public.tasks
FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tasks in their workspaces"
ON public.tasks
FOR INSERT
WITH CHECK (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tasks in their workspaces"
ON public.tasks
FOR UPDATE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tasks in their workspaces"
ON public.tasks
FOR DELETE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
