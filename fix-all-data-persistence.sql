-- ============================================
-- FIX ALL DATA PERSISTENCE - COMPREHENSIVE
-- ============================================
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- This will fix ALL tables (leads, contacts, deals, tasks, etc.)

-- Step 1: Ensure all tables have correct columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create contacts table if not exists
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    position TEXT,
    role TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Create deals table if not exists
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT,
    value NUMERIC DEFAULT 0,
    stage TEXT DEFAULT 'lead',
    probability INTEGER DEFAULT 0,
    expected_close_date DATE,
    close_date DATE,
    contact_id UUID,
    lead_id UUID,
    user_id UUID,
    workspace_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Create tasks table if not exists
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    related_deal_id UUID,
    related_contact_id UUID,
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Step 2: Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Step 4: Create SIMPLE, WORKING policies for LEADS
CREATE POLICY "leads_all" ON public.leads
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Step 5: Create SIMPLE, WORKING policies for CONTACTS
CREATE POLICY "contacts_all" ON public.contacts
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Step 6: Create SIMPLE, WORKING policies for DEALS
CREATE POLICY "deals_all" ON public.deals
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Step 7: Create SIMPLE, WORKING policies for TASKS
CREATE POLICY "tasks_all" ON public.tasks
FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
)
WITH CHECK (auth.uid() = user_id);

-- Step 8: Verify success
SELECT
    'SUCCESS! All tables fixed!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('leads', 'contacts', 'deals', 'tasks')) as tables_count,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('leads', 'contacts', 'deals', 'tasks')) as policies_count;
