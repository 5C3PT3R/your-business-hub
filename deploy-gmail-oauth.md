# Deploy Gmail OAuth Edge Function - UPDATED

## Important Note: No Environment Variables Needed!

Supabase automatically provides these environment variables to all edge functions:
- ✅ `SUPABASE_URL` - Auto-provided
- ✅ `SUPABASE_ANON_KEY` - Auto-provided
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided

You **do NOT** need to add `SUPABASE_ANON_KEY` manually!

## Quick Deploy via Dashboard (Recommended)

1. **Deploy Function:**
   - Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/functions
   - Click on **gmail-oauth**
   - Look for a button that says **"Deploy new version"** or **"Edit"**
   - If you see **"Edit"**, click it, then replace ALL the code with contents from: `supabase/functions/gmail-oauth/index.ts`
   - If there's a **"Deploy"** button in the editor, click it
   - If not, look for a **"Save"** or **"Update"** button

   **CRITICAL**: Make sure you're actually deploying/saving, not just editing!

2. **Wait for deployment to complete** (about 30 seconds)
   - Watch for a success message
   - The function logs should show "shutdown" then restart with new boot logs

3. **Test the connection:**
   - Go to your app: https://upflo-lac.vercel.app/settings
   - Navigate to Integrations tab
   - Click "Connect Gmail"
   - Should now work without 401 error!

## Alternative: Deploy via CLI

If you have Supabase CLI installed and logged in:

```bash
# Make sure you're logged in
npx supabase login

# Deploy the function
npx supabase functions deploy gmail-oauth --no-verify-jwt

# Deploy the webhook too (for completeness)
npx supabase functions deploy gmail-webhook --no-verify-jwt
```

## What Was Fixed

The edge function now uses two separate Supabase clients:
- **supabaseClient** (anon key) - For verifying user JWT tokens
- **supabaseAdmin** (service role key) - For database operations

This fixes the "Invalid JWT" error that was happening because the function was trying to verify user tokens with a service role client.

The `SUPABASE_ANON_KEY` is automatically available in all Supabase Edge Functions - no manual configuration needed!

## Verification

After deployment, check the Supabase function logs:
- Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/functions/gmail-oauth
- Click on **Logs** tab
- You should see: "SUPABASE_ANON_KEY exists: true"
- Try connecting Gmail - you should see successful JWT verification logs
