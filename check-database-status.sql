-- Check current database status
-- Run this in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- 1. Check if tables exist
SELECT
    table_name,
    'exists' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('leads', 'contacts', 'deals', 'tasks', 'workspaces', 'workspace_members')
ORDER BY table_name;

-- 2. Check columns in leads table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
ORDER BY ordinal_position;

-- 3. Check columns in contacts table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contacts'
ORDER BY ordinal_position;

-- 4. Check RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
ORDER BY tablename;

-- 5. Check current policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('leads', 'contacts', 'deals', 'tasks')
ORDER BY tablename, policyname;

-- 6. Check your workspaces
SELECT
    id,
    name,
    owner_id,
    created_at
FROM public.workspaces
ORDER BY created_at;

-- 7. Check workspace_members
SELECT
    wm.workspace_id,
    w.name as workspace_name,
    wm.user_id,
    wm.role
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id
ORDER BY w.created_at;

-- 8. Check actual data in leads
SELECT id, name, email, workspace_id, user_id, created_at
FROM public.leads
ORDER BY created_at DESC
LIMIT 10;

-- 9. Check actual data in contacts
SELECT id, name, email, workspace_id, user_id, created_at
FROM public.contacts
ORDER BY created_at DESC
LIMIT 10;
