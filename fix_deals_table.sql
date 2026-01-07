-- Create and fix deals table
-- Run this in Supabase SQL Editor AFTER running fix_database.sql

-- 1. Create deals table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'lead',
    probability INTEGER DEFAULT 0,
    close_date DATE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add missing columns to deals table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='title') THEN
        ALTER TABLE public.deals ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Deal';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='value') THEN
        ALTER TABLE public.deals ADD COLUMN value NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='stage') THEN
        ALTER TABLE public.deals ADD COLUMN stage TEXT DEFAULT 'lead';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='probability') THEN
        ALTER TABLE public.deals ADD COLUMN probability INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='close_date') THEN
        ALTER TABLE public.deals ADD COLUMN close_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='contact_id') THEN
        ALTER TABLE public.deals ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='lead_id') THEN
        ALTER TABLE public.deals ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='user_id') THEN
        ALTER TABLE public.deals ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='workspace_id') THEN
        ALTER TABLE public.deals ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='notes') THEN
        ALTER TABLE public.deals ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='created_at') THEN
        ALTER TABLE public.deals ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='deals' AND column_name='updated_at') THEN
        ALTER TABLE public.deals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Enable RLS on deals
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate RLS policies for deals
DROP POLICY IF EXISTS "Users can view deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can update deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can delete deals in their workspaces" ON public.deals;

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

-- 5. Create contacts table if missing (needed for deals foreign key)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    role TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Contacts RLS policies
DROP POLICY IF EXISTS "Users can view contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their workspaces" ON public.contacts;

CREATE POLICY "Users can view contacts in their workspaces"
ON public.contacts FOR SELECT
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contacts in their workspaces"
ON public.contacts FOR INSERT
WITH CHECK (
  workspace_id IS NULL AND user_id = auth.uid()
  OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contacts in their workspaces"
ON public.contacts FOR UPDATE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete contacts in their workspaces"
ON public.contacts FOR DELETE
USING (
  workspace_id IS NULL AND user_id = auth.uid()
  OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- 6. Verify the fix
SELECT 'Deals and Contacts tables fixed!' as message;
SELECT COUNT(*) as deal_count FROM public.deals;
SELECT COUNT(*) as contact_count FROM public.contacts;
