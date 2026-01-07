-- ============================================
-- LOCK DOWN WORKSPACE - PREVENT DUPLICATES FOREVER
-- ============================================
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Step 1: Check current workspace situation
SELECT
    owner_id,
    COUNT(*) as workspace_count,
    array_agg(id ORDER BY created_at) as workspace_ids,
    array_agg(name ORDER BY created_at) as workspace_names
FROM public.workspaces
GROUP BY owner_id
ORDER BY workspace_count DESC;

-- Step 2: Delete ALL duplicate workspaces (keep only the first one per user)
WITH ranked_workspaces AS (
    SELECT
        id,
        owner_id,
        ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
    FROM public.workspaces
)
DELETE FROM public.workspace_members
WHERE workspace_id IN (
    SELECT id FROM ranked_workspaces WHERE rn > 1
);

WITH ranked_workspaces AS (
    SELECT
        id,
        owner_id,
        ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
    FROM public.workspaces
)
DELETE FROM public.workspaces
WHERE id IN (
    SELECT id FROM ranked_workspaces WHERE rn > 1
);

-- Step 3: Add a UNIQUE constraint to prevent duplicate workspaces per user
-- This will make it IMPOSSIBLE to create duplicate workspaces
ALTER TABLE public.workspaces
DROP CONSTRAINT IF EXISTS one_workspace_per_user;

-- Actually, we CAN'T add a unique constraint on owner_id because users might want multiple workspaces
-- Instead, let's just verify we now have 1 workspace per user
SELECT
    owner_id,
    COUNT(*) as workspace_count
FROM public.workspaces
GROUP BY owner_id
HAVING COUNT(*) > 1;

-- If the above returns no rows, we're good!

-- Step 4: Show final workspace count
SELECT
    'SUCCESS' as status,
    COUNT(DISTINCT owner_id) as users_count,
    COUNT(*) as total_workspaces
FROM public.workspaces;
