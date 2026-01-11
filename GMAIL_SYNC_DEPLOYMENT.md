# Gmail Sync Deployment Guide

## Quick Start (Option 1 - Easiest)

**Just double-click this file:**
```
deploy-gmail-sync.bat
```

It will handle everything automatically!

---

## Manual Deployment (Option 2)

### Step 1: Login to Supabase

Open a terminal/command prompt and run:

```bash
npx supabase login
```

This will open your browser to authenticate with Supabase.

### Step 2: Deploy the Function

After logging in, run:

```bash
npx supabase functions deploy gmail-sync --project-ref pesqbkgfsfkqdquhilsv
```

You should see output like:
```
Deploying Function (project-ref: pesqbkgfsfkqdquhilsv)...
        gmail-sync (deployed)
```

### Step 3: Test the Sync

1. Navigate to http://localhost:8080/inbox
2. Click the **"Sync Gmail"** button in the top-right corner
3. Wait for the sync to complete (you'll see a toast notification)
4. Your Gmail messages will now appear in the inbox!

---

## Troubleshooting

### Error: "Access token not provided"

**Solution:** Run `npx supabase login` first

### Error: "Failed to sync Gmail"

**Possible causes:**
1. **Gmail not connected** - Make sure you've connected Gmail in Settings
2. **Edge function not deployed** - Follow the deployment steps above
3. **Token expired** - Disconnect and reconnect Gmail in Settings

### Error: "Invalid token"

**Solution:** The edge function couldn't verify your auth token. Check that:
1. You're logged in to the app
2. Your session hasn't expired (try refreshing the page)

---

## What the Sync Does

The gmail-sync Edge Function will:
- ✅ Fetch your 50 most recent Gmail inbox messages
- ✅ Store them in the `conversations` table
- ✅ Skip messages that are already synced (no duplicates)
- ✅ Preserve Gmail labels (unread, starred, etc.)
- ✅ Extract sender, recipients, subject, body
- ✅ Detect inbound vs outbound direction

After syncing, you'll see a success message like:
```
Gmail synced successfully
Synced 50 new messages, skipped 0 existing messages.
```

---

## Verification

To verify the function is deployed:

```bash
npx supabase functions list
```

You should see `gmail-sync` in the list of functions.

---

## Need Help?

If deployment fails, you can also deploy via the Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv
2. Navigate to **Edge Functions**
3. Click **"New function"**
4. Name it `gmail-sync`
5. Copy the contents from `supabase/functions/gmail-sync/index.ts`
6. Click **Deploy**

Then test by clicking "Sync Gmail" in your inbox!
