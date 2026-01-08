# Gmail OAuth 401 "Invalid JWT" Fix

## Problem Identified
The Gmail OAuth flow was failing with a **401 "Invalid JWT"** error when trying to connect Gmail in the settings/integrations tab.

## Root Cause
The edge function was using a **service role Supabase client** to verify **user JWT tokens**. This doesn't work properly because:
- User JWT tokens are issued for the anon key context
- Service role clients expect service role JWTs, not user JWTs
- The `supabase.auth.getUser(userToken)` call fails when using a service role client

## The Fix
Created two separate Supabase clients in the edge function:
1. **supabaseClient** - Uses `SUPABASE_ANON_KEY` for JWT verification
2. **supabaseAdmin** - Uses `SUPABASE_SERVICE_ROLE_KEY` for database operations

### Files Changed

#### 1. `supabase/functions/gmail-oauth/index.ts`
- Added `SUPABASE_ANON_KEY` environment variable
- Created `supabaseClient` for user JWT verification
- Created `supabaseAdmin` for database operations
- Updated all handler functions to use the correct client

#### 2. `supabase/config.toml`
- Added `[functions.gmail-oauth]` config with `verify_jwt = false`
- Added `[functions.gmail-webhook]` config with `verify_jwt = false`

## Required Environment Variable

**CRITICAL**: You must add `SUPABASE_ANON_KEY` to your Supabase Edge Functions environment:

### Where to find the value:
Your anon key (from `.env` file):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU3MTYsImV4cCI6MjA4MjA4MTcxNn0.SuRLVpP_k8vbSiZeTG_aJY9qiOPvRLiZo8amZNv2YTQ
```

### How to add it:
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv
2. Navigate to **Settings** → **Edge Functions**
3. Add a new secret:
   - Name: `SUPABASE_ANON_KEY`
   - Value: (paste the anon key from above)
4. Save

## Deployment Instructions

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/functions
2. Click on the **gmail-oauth** function
3. Click **Deploy new version**
4. Copy the entire contents of `supabase/functions/gmail-oauth/index.ts`
5. Paste and deploy

### Option 2: Supabase CLI
```bash
# Login to Supabase
npx supabase login

# Deploy the function
npx supabase functions deploy gmail-oauth --no-verify-jwt

# Also deploy the config
npx supabase functions deploy gmail-webhook --no-verify-jwt
```

## Testing the Fix

After deployment:

1. **Add the SUPABASE_ANON_KEY environment variable** (see above)
2. Go to your app: https://upflo-lac.vercel.app/settings
3. Navigate to **Integrations** tab
4. Click **Connect Gmail**
5. The OAuth flow should now work correctly

### Expected Behavior:
- A popup window will open with Google OAuth
- You'll be asked to grant permissions
- After approval, you'll see "Gmail Connected Successfully!"
- The popup will close automatically
- Your Gmail status will show as "Connected"

## What Changed (Technical Details)

### Before:
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// ...
const { data: { user }, error } = await supabase.auth.getUser(token);
// ❌ This fails because we're verifying a user JWT with a service role client
```

### After:
```typescript
// Anon client for JWT verification
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Admin client for database operations
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ...
const { data: { user }, error } = await supabaseClient.auth.getUser(token);
// ✅ This works because we're verifying a user JWT with an anon client
```

## Summary

The fix separates concerns:
- **User authentication** → Uses anon key (supabaseClient)
- **Database operations** → Uses service role key (supabaseAdmin)

This is the proper way to handle JWT verification in Supabase Edge Functions when you need to verify user tokens but also perform admin operations.
