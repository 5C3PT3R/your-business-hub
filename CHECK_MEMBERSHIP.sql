-- Run this in Supabase SQL Editor to check workspace membership
-- https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Get current user's ID from auth.users
SELECT
  'Current User ID' as info,
  id as user_id,
  email
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- Check all workspaces
SELECT
  'All Workspaces' as info,
  id as workspace_id,
  name,
  owner_id,
  created_at
FROM public.workspaces
ORDER BY created_at DESC;

-- Check workspace members for all workspaces
SELECT
  'All Workspace Members' as info,
  wm.workspace_id,
  w.name as workspace_name,
  wm.user_id,
  wm.role,
  wm.created_at
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id
ORDER BY wm.created_at DESC;

-- Check if there are leads without membership
SELECT
  'Leads without proper membership' as issue,
  l.id as lead_id,
  l.name as lead_name,
  l.workspace_id,
  l.user_id,
  w.name as workspace_name,
  w.owner_id as workspace_owner,
  CASE
    WHEN wm.user_id IS NULL THEN 'NO MEMBERSHIP FOUND'
    ELSE 'Member exists'
  END as membership_status
FROM public.leads l
LEFT JOIN public.workspaces w ON l.workspace_id = w.id
LEFT JOIN public.workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = l.user_id
ORDER BY l.created_at DESC;

-- Count leads by workspace
SELECT
  'Leads count by workspace' as info,
  w.name as workspace_name,
  w.id as workspace_id,
  COUNT(l.id) as lead_count
FROM public.workspaces w
LEFT JOIN public.leads l ON l.workspace_id = w.id
GROUP BY w.id, w.name;
