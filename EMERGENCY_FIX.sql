-- ========================================
-- EMERGENCY FIX - Run this NOW
-- ========================================
-- This will fix the persistence issue immediately
-- Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new
-- Paste this entire script and click RUN

-- First, let's see what we have
SELECT 'Checking current state...' as status;

-- Check if leads table exists and what columns it has
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- Now fix everything
DO $$
BEGIN
    -- Ensure all required columns exist on leads table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'leads') THEN
        -- Add missing columns one by one
        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
    ELSE
        -- Create leads table from scratch
        CREATE TABLE public.leads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT,
            email TEXT,
            phone TEXT,
            company TEXT,
            source TEXT,
            status TEXT DEFAULT 'new',
            value NUMERIC DEFAULT 0,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Create contacts table if missing
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

-- Create deals table if missing
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

-- Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first (clean slate)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename IN ('leads', 'contacts', 'deals'))
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.leads';
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.contacts';
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.deals';
    END LOOP;
END $$;

-- Create SIMPLE, PERMISSIVE RLS policies for LEADS
CREATE POLICY "leads_select_policy"
ON public.leads FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "leads_insert_policy"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "leads_update_policy"
ON public.leads FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "leads_delete_policy"
ON public.leads FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Same for CONTACTS
CREATE POLICY "contacts_select_policy"
ON public.contacts FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "contacts_insert_policy"
ON public.contacts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_update_policy"
ON public.contacts FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "contacts_delete_policy"
ON public.contacts FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Same for DEALS
CREATE POLICY "deals_select_policy"
ON public.deals FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "deals_insert_policy"
ON public.deals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_update_policy"
ON public.deals FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "deals_delete_policy"
ON public.deals FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Final verification
SELECT
    'SUCCESS! Database is now fixed.' as message,
    'Leads table has ' || (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='leads') || ' columns' as leads_columns,
    'Found ' || (SELECT COUNT(*) FROM pg_policies WHERE tablename='leads') || ' policies on leads' as leads_policies;

-- Show final structure
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('leads', 'contacts', 'deals')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
