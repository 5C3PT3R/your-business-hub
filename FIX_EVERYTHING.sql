-- ============================================
-- COMPLETE DATABASE FIX - RUN THIS ONE SCRIPT
-- ============================================
-- This will fix ALL issues with persistence
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Step 1: Ensure leads table has all columns
DO $$
BEGIN
    -- Create leads table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leads') THEN
        CREATE TABLE public.leads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Add all required columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='name') THEN
        ALTER TABLE public.leads ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='email') THEN
        ALTER TABLE public.leads ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='phone') THEN
        ALTER TABLE public.leads ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='company') THEN
        ALTER TABLE public.leads ADD COLUMN company TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='source') THEN
        ALTER TABLE public.leads ADD COLUMN source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='status') THEN
        ALTER TABLE public.leads ADD COLUMN status TEXT DEFAULT 'new';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='value') THEN
        ALTER TABLE public.leads ADD COLUMN value NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='user_id') THEN
        ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='workspace_id') THEN
        ALTER TABLE public.leads ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2: Create contacts table
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

-- Step 3: Create deals table
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

-- Step 4: Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies
DROP POLICY IF EXISTS "Users can view leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their workspaces" ON public.leads;

DROP POLICY IF EXISTS "Users can view contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their workspaces" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their workspaces" ON public.contacts;

DROP POLICY IF EXISTS "Users can view deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can update deals in their workspaces" ON public.deals;
DROP POLICY IF EXISTS "Users can delete deals in their workspaces" ON public.deals;

-- Step 6: Create RLS policies for LEADS
CREATE POLICY "Users can view leads in their workspaces"
ON public.leads FOR SELECT
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create leads in their workspaces"
ON public.leads FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update leads in their workspaces"
ON public.leads FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete leads in their workspaces"
ON public.leads FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Step 7: Create RLS policies for CONTACTS
CREATE POLICY "Users can view contacts in their workspaces"
ON public.contacts FOR SELECT
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create contacts in their workspaces"
ON public.contacts FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contacts in their workspaces"
ON public.contacts FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete contacts in their workspaces"
ON public.contacts FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Step 8: Create RLS policies for DEALS
CREATE POLICY "Users can view deals in their workspaces"
ON public.deals FOR SELECT
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create deals in their workspaces"
ON public.deals FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update deals in their workspaces"
ON public.deals FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete deals in their workspaces"
ON public.deals FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Step 9: Verify everything worked
SELECT
    'SUCCESS! All tables created and secured.' as status,
    (SELECT COUNT(*) FROM public.leads) as current_leads,
    (SELECT COUNT(*) FROM public.contacts) as current_contacts,
    (SELECT COUNT(*) FROM public.deals) as current_deals;

-- Show table structure
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('leads', 'contacts', 'deals')
ORDER BY table_name, ordinal_position;
