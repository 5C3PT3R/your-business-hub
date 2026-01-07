-- Clean up duplicate workspaces
-- Run in: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

-- First, let's see what we have
SELECT
    id,
    name,
    created_at,
    owner_id
FROM public.workspaces
ORDER BY created_at DESC
LIMIT 10;

-- Keep only the FIRST workspace created for each user
-- Delete all duplicates
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

-- Show remaining workspaces
SELECT
    COUNT(*) as remaining_workspaces,
    'Duplicates cleaned!' as status
FROM public.workspaces;
