-- Debug queries to check data persistence
-- Run these in Supabase SQL Editor: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- 1. Check if leads exist in database
SELECT id, name, company, email, workspace_id, user_id, created_at
FROM public.leads
ORDER BY created_at DESC;

-- 2. Check if contacts exist in database
SELECT id, name, company, email, workspace_id, user_id, created_at
FROM public.contacts
ORDER BY created_at DESC;

-- 3. Check workspaces
SELECT id, name, owner_id, created_at
FROM public.workspaces
ORDER BY created_at DESC;

-- 4. Check workspace members
SELECT wm.workspace_id, wm.user_id, wm.role, w.name as workspace_name
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id
ORDER BY wm.created_at DESC;

-- 5. Check if leads have proper workspace_id and user is a member
SELECT
  l.id,
  l.name,
  l.workspace_id,
  l.user_id,
  w.name as workspace_name,
  w.owner_id,
  wm.user_id as member_user_id,
  wm.role
FROM public.leads l
LEFT JOIN public.workspaces w ON l.workspace_id = w.id
LEFT JOIN public.workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = l.user_id
ORDER BY l.created_at DESC;
