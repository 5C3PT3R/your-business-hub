# Gmail Integration Setup Guide

## 🎯 Overview

This guide will help you complete the Gmail integration for Rapport CRM. You've already:
- ✅ Created Google OAuth credentials
- ✅ Set up database schema
- ✅ Built Edge Functions with security

## 📋 Prerequisites Checklist

- [x] Google Cloud Project created
- [x] Gmail API enabled
- [x] OAuth Client ID: `957096193722-9ok1std8gi9ulea73843glis9p7pbboq.apps.googleusercontent.com`
- [x] OAuth Client Secret: `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`
- [x] Supabase Service Role Key: `eyJ...` (you provided this)
- [ ] Google Pub/Sub topic configured
- [ ] Encryption key generated
- [ ] Environment variables configured

---

## 🔐 Step 1: Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this key - you'll add it to your Supabase environment variables.

---

## ⚙️ Step 2: Configure Supabase Environment Variables

Go to your Supabase Dashboard → Settings → Edge Functions → Environment Variables

Add these variables:

### Required Variables

```env
# Gmail OAuth
GMAIL_CLIENT_ID=957096193722-9ok1std8gi9ulea73843glis9p7pbboq.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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

# Encryption (generate with command above)
ENCRYPTION_KEY=your_generated_32_char_hex_key_here

# Supabase (already set, but verify)
SUPABASE_URL=https://pesqbkgfsfkqdquhilsv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3Fia2dmc2ZrcWRxdWhpbHN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjUwNTcxNiwiZXhwIjoyMDgyMDgxNzE2fQ.Av72m--WNTRtJsSxlFxEaX7SCFOWdaip7JXmAu3dAEg

# OpenAI & Lovable (already configured)
OPENAI_API_KEY=your_key
LOVABLE_API_KEY=your_key
```

---

## 📨 Step 3: Set Up Google Pub/Sub (Real-Time Webhooks)

### 3.1 Enable Pub/Sub API

1. Go to https://console.cloud.google.com/apis/library/pubsub.googleapis.com
2. Click **"Enable"**

### 3.2 Create Pub/Sub Topic

1. Go to https://console.cloud.google.com/cloudpubsub/topic/list
2. Click **"Create Topic"**
3. Topic ID: `gmail-push-notifications`
4. Click **"Create"**

### 3.3 Grant Gmail Permission to Publish

1. In the topic page, click **"Permissions"** tab
2. Click **"Add Principal"**
3. New principal: `gmail-api-push@system.gserviceaccount.com`
4. Role: **"Pub/Sub Publisher"**
5. Click **"Save"**

### 3.4 Create Push Subscription

1. Click **"Create Subscription"**
2. Subscription ID: `gmail-push-sub`
3. Delivery type: **"Push"**
4. Endpoint URL: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/gmail-webhook`
5. Click **"Create"**

### 3.5 Enable Gmail Push Notifications (Per User)

This will be done programmatically when a user connects their Gmail:

```typescript
// Call this after OAuth is complete
async function enableGmailPushNotifications(accessToken: string) {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/watch',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-push-notifications',
        labelIds: ['INBOX'],
        labelFilterAction: 'include',
      }),
    }
  );

  return await response.json();
}
```

**Get your Google Cloud Project ID:**
- Go to https://console.cloud.google.com/
- Project ID is shown at the top (format: `project-name-123456`)

---

## 🗄️ Step 4: Run Database Migration

From your project directory:

```bash
# If using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard:
# 1. Go to Database → SQL Editor
# 2. Create new query
# 3. Copy contents of supabase/migrations/20260107_gmail_integration.sql
# 4. Run the query
```

---

## 🚀 Step 5: Deploy Edge Functions

```bash
# Deploy all new Edge Functions
supabase functions deploy gmail-oauth
supabase functions deploy gmail-webhook

# If deploying from Windows, you may need to use npx
npx supabase functions deploy gmail-oauth
npx supabase functions deploy gmail-webhook
```

---

## 🧪 Step 6: Test the Integration

### 6.1 Test OAuth Flow

1. Open your app
2. Go to Settings → Integrations
3. Click "Connect Gmail"
4. You should be redirected to Google
5. Authorize the app
6. You should see "Gmail Connected Successfully!"

### 6.2 Test Message Ingestion

1. Send a test email to the connected Gmail account
2. Wait 30-60 seconds (Pub/Sub + processing time)
3. Check your CRM:
   - New lead should be created (if sender is new)
   - New activity should appear
   - AI analysis should run automatically

### 6.3 Check Logs

```bash
# View Edge Function logs
supabase functions logs gmail-oauth
supabase functions logs gmail-webhook
```

---

## 🔒 Security Checklist

Before going to production:

- [ ] Encryption key is at least 32 characters
- [ ] Service role key is stored securely (never in frontend code)
- [ ] OAuth redirect URI matches exactly
- [ ] Pub/Sub subscription uses HTTPS endpoint
- [ ] Rate limiting is configured (100 req/min per user)
- [ ] Audit logs are being written
- [ ] Test with multiple Gmail accounts
- [ ] Test token refresh (wait for token to expire)
- [ ] Test duplicate message handling
- [ ] Review audit_log table for any high-risk events

---

## 📊 Monitoring & Maintenance

### Daily Checks

```sql
-- Check for failed webhook deliveries
SELECT COUNT(*) FROM audit_log
WHERE action = 'webhook_signature_failed'
AND created_at > NOW() - INTERVAL '24 hours';

-- Check for high-risk events
SELECT * FROM audit_log
WHERE risk_level IN ('high', 'critical')
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check message ingestion rate
SELECT COUNT(*) FROM activities
WHERE channel = 'gmail'
AND created_at > NOW() - INTERVAL '24 hours';
```

### Weekly Cleanup

```sql
-- Clean up expired deduplication keys
DELETE FROM message_dedup WHERE expires_at < NOW();

-- Clean up old rate limit entries (keep 7 days)
DELETE FROM rate_limits
WHERE window_start < NOW() - INTERVAL '7 days'
AND blocked_until IS NULL;
```

---

## 🐛 Troubleshooting

### "Gmail not connected" Error

**Cause:** OAuth tokens not found in database
**Fix:** User needs to reconnect Gmail via Settings → Integrations

### "Token expired - please reconnect"

**Cause:** Refresh token is invalid (user may have revoked access)
**Fix:** User needs to reconnect Gmail

### No messages being ingested

**Check:**
1. Is Pub/Sub subscription active? (Google Cloud Console)
2. Are webhook logs showing activity? (`supabase functions logs gmail-webhook`)
3. Is the Gmail account receiving emails?
4. Check `message_dedup` table - are duplicates being skipped?

### Rate limit errors

**Cause:** User exceeded 1000 requests/minute (very unlikely for webhooks)
**Fix:** Check if there's a loop or spam attack. Review `rate_limits` table.

### Webhook signature verification failing

**Cause:** Pub/Sub is not properly configured
**Fix:** Verify Pub/Sub subscription endpoint URL is correct

---

## 🎨 Next Steps

Now that Gmail is integrated, you should:

1. **Build the UI components** (see below)
2. **Add email sending workflow** (AI drafts with approval)
3. **Test with 3-5 beta users**
4. **Monitor for 1 week**
5. **Start Meta (Instagram/Facebook) integration**

---

## 📱 Frontend UI Components Needed

The following React components need to be created:

### 1. Gmail Connect Button
**File:** `src/components/integrations/GmailConnect.tsx`

**Features:**
- "Connect Gmail" button
- Shows connection status
- Disconnect button
- Last synced time

### 2. Integrations Settings Page
**File:** `src/pages/Settings.tsx` (add Integrations tab)

**Features:**
- List all available integrations
- Gmail, Instagram, Facebook cards
- Connected/Not Connected status
- Connect/Disconnect buttons

### 3. Email Send Approval UI
**File:** `src/components/email/EmailApprovalModal.tsx`

**Features:**
- Shows AI-generated email draft
- Confidence score indicator
- Edit draft before sending
- Approve/Reject buttons
- Preview how email will look

---

## 🔗 Important URLs

- **Google Cloud Console:** https://console.cloud.google.com/
- **Supabase Dashboard:** https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv
- **Gmail API Docs:** https://developers.google.com/gmail/api
- **Pub/Sub Docs:** https://cloud.google.com/pubsub/docs

---

## 📞 Support

If you encounter issues:

1. Check Edge Function logs: `supabase functions logs <function-name>`
2. Check database: Query `audit_log` table for errors
3. Review Google Cloud Logs: https://console.cloud.google.com/logs
4. Check Pub/Sub subscription status

---

**Created:** 2026-01-07
**Status:** Ready for deployment
**Next:** Generate encryption key and configure environment variables
