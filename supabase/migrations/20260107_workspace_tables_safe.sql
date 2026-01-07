-- Safe migration: Create workspace tables only if they don't exist

-- Create industry type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.industry_type AS ENUM ('sales', 'real_estate', 'ecommerce', 'banking', 'insurance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry_type public.industry_type NOT NULL,
  owner_id UUID NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workspace members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
  )
$$;

-- Security definer function to check if user is workspace owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = _workspace_id
      AND owner_id = _user_id
  )
$$;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspace members if they are a member" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can insert members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can delete members" ON public.workspace_members;

-- RLS Policies for workspaces
CREATE POLICY "Users can view workspaces they are members of"
ON public.workspaces
FOR SELECT
USING (public.is_workspace_member(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
ON public.workspaces
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their workspaces"
ON public.workspaces
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their workspaces"
ON public.workspaces
FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for workspace_members
CREATE POLICY "Users can view workspace members if they are a member"
ON public.workspace_members
FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can insert members"
ON public.workspace_members
FOR INSERT
WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id) OR auth.uid() = user_id);

CREATE POLICY "Workspace owners can delete members"
ON public.workspace_members
FOR DELETE
USING (public.is_workspace_owner(auth.uid(), workspace_id));
