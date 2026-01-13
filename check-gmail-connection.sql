-- Run this SQL in your Supabase SQL Editor to check Gmail connection

-- Check if you have a profile
SELECT
    'Profile Check' as check_type,
    COUNT(*) as count,
    json_agg(json_build_object('id', id, 'email', email)) as data
FROM profiles
WHERE id = auth.uid();

-- Check if you have Gmail oauth tokens
SELECT
    'OAuth Tokens Check' as check_type,
    COUNT(*) as count,
    json_agg(json_build_object(
        'id', id,
        'user_id', user_id,
        'channel', channel,
        'email_address', email_address,
        'expires_at', expires_at,
        'created_at', created_at
    )) as data
FROM oauth_tokens
WHERE user_id = auth.uid() AND channel = 'gmail';

-- Check if user_id matches between auth and oauth_tokens
SELECT
    'User ID Match Check' as check_type,
    auth.uid() as auth_user_id,
    (SELECT user_id FROM oauth_tokens WHERE channel = 'gmail' LIMIT 1) as oauth_user_id,
    CASE
        WHEN auth.uid() = (SELECT user_id FROM oauth_tokens WHERE channel = 'gmail' LIMIT 1)
        THEN 'MATCH'
        ELSE 'MISMATCH'
    END as status;
