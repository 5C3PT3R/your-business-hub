-- Run this SQL in Supabase SQL Editor to ensure your profile exists
-- This is needed because oauth_tokens references profiles(id)

-- Create your profile if it doesn't exist
INSERT INTO profiles (id, email, created_at, updated_at)
SELECT
    auth.uid(),
    auth.email(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
);

-- Verify profile was created
SELECT
    'Profile exists' as status,
    id,
    email,
    created_at
FROM profiles
WHERE id = auth.uid();
