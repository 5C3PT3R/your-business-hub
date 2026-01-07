# Twilio Webhook Configuration Guide

This guide shows you exactly how to configure webhooks in the Twilio dashboard so your CRM can receive call status updates and recordings.

## What Are Webhooks?

Webhooks allow Twilio to send real-time updates to your CRM when:
- A call status changes (ringing → answered → completed)
- A call recording is ready to download

Without webhooks configured, your app won't receive these updates!

---

## Step-by-Step Instructions

### Step 1: Log in to Twilio Console

1. Go to https://console.twilio.com
2. Log in with your Twilio account

### Step 2: Navigate to Phone Numbers

1. In the left sidebar, click on **"Phone Numbers"**
2. Click on **"Manage"**
3. Click on **"Active numbers"**

   Or go directly to: https://console.twilio.com/us1/develop/phone-numbers/manage/active

### Step 3: Select Your Phone Number

1. You'll see a list of your Twilio phone numbers
2. Click on the phone number you want to use for calling (the one you added to Supabase secrets)

### Step 4: Scroll to "Voice Configuration" Section

1. Scroll down the page until you see **"Voice Configuration"** or **"Voice & Fax"**
2. This section controls what happens when calls are made/received with this number

### Step 5: Configure Webhooks

In the Voice Configuration section, you'll see several fields. Configure them as follows:

#### A. Configure Voice URL (Optional)
This is what Twilio does when someone calls YOUR Twilio number (incoming calls). You can skip this if you're only making outbound calls.

- **A Call Comes In**: Select "Webhook"
- **URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
- **HTTP Method**: `POST`

#### B. Configure Status Callback URL (REQUIRED)
This sends updates about call status (ringing, answered, completed, etc.)

Look for a field labeled **"Status Callback URL"** or **"Status Callback"**

- **Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
- **HTTP Method**: `POST`
- **Events to Send**: Check ALL boxes:
  - ☑️ Initiated
  - ☑️ Ringing
  - ☑️ Answered
  - ☑️ Completed

#### C. Configure Recording Status Callback (REQUIRED)
This sends the URL of the call recording when it's ready.

Look for a section about **"Recording"** or scroll down to find:

- **Recording Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
- **HTTP Method**: `POST`

### Step 6: Save Configuration

1. Scroll to the bottom of the page
2. Click the **"Save"** or **"Save Configuration"** button (usually red)
3. Wait for the success message

---

## Webhook URL Explanation

Your webhook URL is: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`

Breaking it down:
- `https://pesqbkgfsfkqdquhilsv.supabase.co` - Your Supabase project URL
- `/functions/v1/` - Supabase Edge Functions path
- `twilio-webhook` - The specific function that handles Twilio callbacks

This URL is PUBLIC and designed to receive webhooks from Twilio. The function validates requests are coming from Twilio using authentication.

---

## Visual Guide

### What You're Looking For:

```
┌─────────────────────────────────────────────────────────────┐
│ Voice Configuration                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ A CALL COMES IN                                             │
│ ┌──────────┐  ┌────────────────────────────────────────┐  │
│ │ Webhook ▼│  │ [Your webhook URL here]                 │  │
│ └──────────┘  └────────────────────────────────────────┘  │
│ ┌──────────┐                                               │
│ │ HTTP POST▼│                                              │
│ └──────────┘                                               │
│                                                              │
│ STATUS CALLBACK URL                                         │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ https://pesqbkgfsfkqdquhilsv.supabase.co/functions/... │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌──────────┐                                               │
│ │ HTTP POST▼│                                              │
│ └──────────┘                                               │
│ Status callback events:                                     │
│ ☑ Initiated  ☑ Ringing  ☑ Answered  ☑ Completed          │
│                                                              │
│ RECORDING SETTINGS                                          │
│ Record calls: ┌──────────────────┐                         │
│               │ Record from answer│                         │
│               └──────────────────┘                         │
│                                                              │
│ Recording Status Callback URL                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ https://pesqbkgfsfkqdquhilsv.supabase.co/functions/... │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌──────────┐                                               │
│ │ HTTP POST▼│                                              │
│ └──────────┘                                               │
│                                                              │
│                                   ┌──────────────────┐     │
│                                   │  Save            │     │
│                                   └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Your Configuration

After saving, test that webhooks are working:

1. Go to your app: http://localhost:8080
2. Navigate to a Lead with a phone number
3. Click "Call"
4. Make a test call

### What Should Happen:

1. **Immediately**: Call initiates, status shows "Connecting..."
2. **After 2-3 seconds**: Status updates to "Ringing..." (webhook received!)
3. **When answered**: Status shows "Connected" with timer (webhook received!)
4. **After ending call**: Call summary appears with duration
5. **After ~30 seconds**: Recording URL appears in database (webhook received!)

### If Webhooks Aren't Working:

- Status stays stuck at "Connecting..." - webhooks not configured
- No recording URL after call ends - recording webhook not configured
- Call works but no updates - Status callback URL incorrect

---

## Troubleshooting

### "Save" Button Is Disabled

Make sure you've filled in all required fields. Some fields might be marked with a red asterisk (*).

### Can't Find "Status Callback URL"

Different Twilio accounts may have different UI layouts. Try:
1. Looking under "Advanced Configuration"
2. Clicking "Show Advanced Options"
3. Expanding any collapsed sections

### Wrong URL Format Error

Make sure your URL:
- Starts with `https://` (not `http://`)
- Has NO trailing slash
- Matches exactly: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`

### Testing Webhooks

You can test if Twilio can reach your webhook:

1. In Twilio Console, go to your phone number settings
2. Look for a "Test" button next to Status Callback URL
3. Click it to send a test webhook
4. Check Supabase logs: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/logs/edge-functions

---

## Alternative: Set Global Webhooks

If you want ALL your Twilio numbers to use the same webhooks:

1. Go to https://console.twilio.com/us1/develop/voice/settings/general
2. Under "Programmable Voice Settings"
3. Set:
   - **Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
   - **Recording Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`

This applies to all numbers but can be overridden per-number.

---

## Need Help?

If you're still stuck:

1. Check Twilio's documentation: https://www.twilio.com/docs/voice/api/call-resource#statuscallback
2. View your webhook logs in Supabase: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/logs/edge-functions
3. Check Twilio's debugger: https://console.twilio.com/us1/monitor/logs/debugger

---

## Summary Checklist

Before testing calls, verify:

- ✅ Twilio credentials added to Supabase secrets
- ✅ Status Callback URL configured
- ✅ Recording Status Callback URL configured
- ✅ Both set to HTTP POST
- ✅ Configuration saved
- ✅ Edge functions deployed

Once all checked, your calling feature should be fully operational!
