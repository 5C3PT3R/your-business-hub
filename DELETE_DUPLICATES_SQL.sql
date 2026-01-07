-- ============================================
-- DELETE DUPLICATE WORKSPACES - SIMPLE SQL
-- ============================================
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- Step 1: See what workspaces you have
SELECT
    id,
    name,
    owner_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as row_num
FROM public.workspaces
ORDER BY owner_id, created_at;

-- Step 2: Delete workspace_members for duplicate workspaces
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

-- Step 3: Delete duplicate workspaces (keep only the first one per user)
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

-- Step 4: Verify - should show only 1 workspace per user
SELECT
    owner_id,
    COUNT(*) as workspace_count,
    array_agg(name) as workspace_names
FROM public.workspaces
GROUP BY owner_id;

SELECT '✅ DUPLICATES DELETED! You now have 1 workspace per user.' as result;
