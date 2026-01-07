-- Create task enums
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  due_date DATE,
  related_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  related_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
DROP POLICY IF EXISTS "Users can view tasks in their workspaces" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their workspaces" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their workspaces" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their workspaces" ON public.tasks;

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

-- Add updated_at trigger
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
