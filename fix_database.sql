-- Check and fix leads table structure
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- 1. Check current leads table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
ORDER BY ordinal_position;

-- 2. Add missing columns if they don't exist
DO $$
BEGIN
    -- Add name column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='name') THEN
        ALTER TABLE public.leads ADD COLUMN name TEXT;
    END IF;

    -- Add email column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='email') THEN
        ALTER TABLE public.leads ADD COLUMN email TEXT;
    END IF;

    -- Add phone column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='phone') THEN
        ALTER TABLE public.leads ADD COLUMN phone TEXT;
    END IF;

    -- Add company column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='company') THEN
        ALTER TABLE public.leads ADD COLUMN company TEXT;
    END IF;

    -- Add source column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='source') THEN
        ALTER TABLE public.leads ADD COLUMN source TEXT;
    END IF;

    -- Add status column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='status') THEN
        ALTER TABLE public.leads ADD COLUMN status TEXT DEFAULT 'new';
    END IF;

    -- Add value column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='value') THEN
        ALTER TABLE public.leads ADD COLUMN value NUMERIC DEFAULT 0;
    END IF;

    -- Add user_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='user_id') THEN
        ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add workspace_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='workspace_id') THEN
        ALTER TABLE public.leads ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;

    -- Add created_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='leads' AND column_name='created_at') THEN
        ALTER TABLE public.leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate RLS policies
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

-- 5. Verify the fix
SELECT 'Leads table fixed!' as message;
SELECT COUNT(*) as lead_count FROM public.leads;
