# Edge Functions Setup Guide

## Current Issues Fixed

✅ **Gmail OAuth** - Changed from POST to GET, added env var validation
✅ **AI Agent** - Added proper error handling for missing OpenAI API key

## Required Environment Variables

You need to set these in Supabase Edge Functions settings:

### For Gmail OAuth (`gmail-oauth` function)
```
GMAIL_CLIENT_ID=your-google-oauth-client-id
GMAIL_CLIENT_SECRET=your-google-oauth-client-secret
```

### For AI Agent (`crm-agent` function)
```
OPENAI_API_KEY=your-openai-api-key
```

---

## How to Set Environment Variables

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/settings/functions
2. Click on "Edge Functions"
3. Click on "Manage secrets"
4. Add the environment variables listed above

### Option 2: Using Supabase CLI

```bash
# Set Gmail OAuth credentials
supabase secrets set GMAIL_CLIENT_ID=your-client-id
supabase secrets set GMAIL_CLIENT_SECRET=your-client-secret

# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-...your-key...
```

---

## Deploying the Edge Functions

### Deploy Gmail OAuth Function

```bash
cd supabase/functions
supabase functions deploy gmail-oauth
```

### Deploy AI Agent Function

```bash
supabase functions deploy crm-agent
```

---

## Testing the Functions

### Test Gmail OAuth

1. Go to your app: https://upflo-lac.vercel.app/
2. Navigate to Settings → Integrations
3. Click "Connect Gmail"
4. You should either:
   - ✅ Get redirected to Google OAuth (if env vars are set)
   - ❌ Get error: "Gmail OAuth not configured" (if env vars missing)

### Test AI Agent

1. Go to Leads page
2. Try to use AI features
3. You should either:
   - ✅ Get AI responses (if OPENAI_API_KEY is set)
   - ❌ Get error: "AI agent not configured" (if API key missing)

---

## Getting Google OAuth Credentials

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable Gmail API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Authorized redirect URIs:
   ```
   https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/gmail-oauth/callback
   ```
7. Copy the Client ID and Client Secret

---

## Getting OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

---

## Current Status

### Frontend Changes ✅
- [x] Gmail OAuth changed from POST to GET
- [x] All changes pushed to GitHub
- [x] Vercel is deploying

### Edge Function Changes ✅
- [x] Gmail OAuth function updated with env var checks
- [x] AI agent function updated with env var checks
- [x] Code committed to Git

### What You Need to Do ⚠️

1. **Set Environment Variables** in Supabase (see above)
2. **Deploy Edge Functions** using Supabase CLI:
   ```bash
   supabase functions deploy gmail-oauth
   supabase functions deploy crm-agent
   ```
3. **Test Both Functions** to ensure they work

---

## Error Messages You'll See

### Before Setting Env Vars:
- Gmail: "Gmail OAuth not configured - GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables must be set"
- AI Agent: "AI agent not configured - OPENAI_API_KEY environment variable must be set"

### After Setting Env Vars:
- Gmail: Redirects to Google OAuth flow
- AI Agent: Returns AI-powered responses

---

## Notes

- The frontend code is already updated and deployed to Vercel
- The edge functions need to be redeployed with the new code
- Both functions will work ONLY after:
  1. Environment variables are set in Supabase
  2. Edge functions are redeployed with `supabase functions deploy`

---

## Quick Deploy Script

Run this after setting environment variables:

```bash
# Navigate to project root
cd e:\your-business-hub

# Deploy both functions
supabase functions deploy gmail-oauth
supabase functions deploy crm-agent

# Verify deployment
supabase functions list
```

---

## Troubleshooting

### "Supabase CLI not found"
Install it:
```bash
npm install -g supabase
```

### "Not logged in to Supabase"
Login first:
```bash
supabase login
```

### "Project not linked"
Link your project:
```bash
supabase link --project-ref pesqbkgfsfkqdquhilsv
```
