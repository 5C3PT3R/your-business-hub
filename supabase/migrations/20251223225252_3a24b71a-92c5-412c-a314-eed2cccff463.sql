-- Add workspace_id to leads table
ALTER TABLE public.leads ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to contacts table
ALTER TABLE public.contacts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to deals table
ALTER TABLE public.deals ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to tasks table
ALTER TABLE public.tasks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to activities table
ALTER TABLE public.activities ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Drop old user-based RLS policies for leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;

-- Create new workspace-based RLS policies for leads
CREATE POLICY "Users can view workspace leads" ON public.leads FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace leads" ON public.leads FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace leads" ON public.leads FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace leads" ON public.leads FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- Drop old user-based RLS policies for contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;

-- Create new workspace-based RLS policies for contacts
CREATE POLICY "Users can view workspace contacts" ON public.contacts FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace contacts" ON public.contacts FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace contacts" ON public.contacts FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace contacts" ON public.contacts FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- Drop old user-based RLS policies for deals
DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;

-- Create new workspace-based RLS policies for deals
CREATE POLICY "Users can view workspace deals" ON public.deals FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace deals" ON public.deals FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace deals" ON public.deals FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace deals" ON public.deals FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- Drop old user-based RLS policies for tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- Create new workspace-based RLS policies for tasks
CREATE POLICY "Users can view workspace tasks" ON public.tasks FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace tasks" ON public.tasks FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace tasks" ON public.tasks FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace tasks" ON public.tasks FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- Drop old user-based RLS policies for activities
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;

-- Create new workspace-based RLS policies for activities
CREATE POLICY "Users can view workspace activities" ON public.activities FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace activities" ON public.activities FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));