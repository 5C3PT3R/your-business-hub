# Twilio Calling Feature Setup

The calling feature is fully implemented but requires Twilio credentials to function. Follow these steps to enable it:

## Prerequisites

1. A Twilio account (sign up at https://www.twilio.com/try-twilio)
2. A Twilio phone number capable of making voice calls

## Step 1: Get Your Twilio Credentials

1. Go to https://console.twilio.com
2. From your dashboard, find:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)
3. Go to Phone Numbers → Manage → Active Numbers
   - Copy your Twilio phone number (format: `+1234567890`)

## Step 2: Configure Supabase Edge Functions

You need to add these credentials as **secrets** to your Supabase Edge Functions:

### Option A: Using Supabase CLI

```bash
cd e:\your-business-hub

# Set Twilio Account SID
npx supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid_here

# Set Twilio Auth Token
npx supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here

# Set Twilio Phone Number (include the + prefix)
npx supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
```

### Option B: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/settings/functions
2. Click on "Edge Functions" in the sidebar
3. Go to "Secrets" tab
4. Add these three secrets:
   - `TWILIO_ACCOUNT_SID` = Your Account SID
   - `TWILIO_AUTH_TOKEN` = Your Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio phone number (e.g., `+1234567890`)

## Step 3: Redeploy Edge Functions (if needed)

After adding secrets, the functions may need to be redeployed:

```bash
npx supabase functions deploy twilio-call
npx supabase functions deploy twilio-status
npx supabase functions deploy twilio-webhook
```

## Step 4: Configure Twilio Webhooks (Important!)

For call recording and status updates to work, configure webhooks in Twilio:

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/active
2. Click on your Twilio phone number
3. Scroll down to "Voice Configuration"
4. Set these webhooks:
   - **Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
   - **Recording Status Callback URL**: `https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/twilio-webhook`
   - Set both to **HTTP POST**

## Step 5: Test the Feature

1. Go to your app at http://localhost:8080
2. Navigate to Leads
3. Click on any lead with a phone number
4. Click the "Call" button
5. The dialer should appear and initiate a call!

## What the Feature Does

Once configured, the calling feature provides:

- ✅ **Outbound Calling**: Call leads directly from the CRM
- ✅ **Call Recording**: Automatically records all calls
- ✅ **Real-time Status**: Shows call state (ringing, connected, duration)
- ✅ **Audio Transcription**: Transcribes calls using OpenAI Whisper
- ✅ **AI Analysis**:
  - Sentiment analysis
  - Follow-up detection
  - Action item extraction
  - Auto-creates tasks from analysis
- ✅ **Call History**: Stores full call logs with transcripts

## Troubleshooting

### "Twilio credentials not configured" Error

This means the Edge Functions don't have access to your Twilio credentials. Make sure you've added all three secrets and redeployed the functions.

### Call Not Connecting

1. Check that your Twilio phone number is active and verified
2. Verify the phone number format includes country code (e.g., `+1234567890`)
3. Check Twilio console for error logs

### Recording Not Working

Make sure you've configured the webhooks in Twilio (Step 4 above). Without webhooks, Twilio can't send recording URLs back to your app.

### Transcription Failing

The transcription feature requires an OpenAI API key. Make sure you have:
```bash
npx supabase secrets set OPENAI_API_KEY=your_openai_key_here
```

## Cost Considerations

- **Twilio**: ~$1/month for phone number + per-minute calling rates
- **OpenAI**: ~$0.006 per minute of audio transcription (Whisper)
- **OpenAI**: ~$0.01 per call analysis (GPT-4)

Estimated cost: ~$0.02-0.05 per call including recording, transcription, and analysis.
