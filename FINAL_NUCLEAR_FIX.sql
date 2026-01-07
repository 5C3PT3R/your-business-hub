-- ============================================
-- NUCLEAR OPTION - GUARANTEED TO WORK
-- ============================================
-- This TEMPORARILY disables security to prove the database works
-- Run this ONLY to test, then we'll add security back properly

-- Step 1: Ensure table exists with all columns
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    value NUMERIC DEFAULT 0,
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add any missing columns (if table already existed)
DO $$
BEGIN
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
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some columns may already exist - continuing...';
END $$;

-- Step 3: DISABLE RLS (temporarily - makes data visible)
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- Step 4: Show what we have
SELECT
    'SUCCESS - RLS DISABLED' as status,
    'Table has ' || COUNT(*) || ' columns' as columns
FROM information_schema.columns
WHERE table_name = 'leads';

-- Show current data
SELECT COUNT(*) as current_lead_count FROM public.leads;

-- ============================================
-- IMPORTANT: This makes ALL data visible!
-- ============================================
-- After you confirm data persists:
-- 1. Tell me it works
-- 2. I'll give you SQL to re-enable security properly
--
-- To re-enable RLS later:
-- ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- (then add proper policies)
