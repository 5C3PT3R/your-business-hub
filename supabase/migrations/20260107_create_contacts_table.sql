-- Create contacts table

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  avatar_url TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
DROP POLICY IF EXISTS "Users can view contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their workspaces" ON public.contacts;

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

-- Add updated_at trigger
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
