# Set Up Environment Variables for Gmail Sync

## The Error You're Seeing

```
Gmail sync failed: failed to decrypt token that may be tampered with
```

This happens because the `ENCRYPTION_KEY` environment variable is not set in your Supabase project.

---

## Required Environment Variables

Your Gmail integration uses encrypted OAuth tokens. You need to set these environment variables in Supabase:

### 1. ENCRYPTION_KEY
A secret key used to encrypt/decrypt OAuth tokens (must be at least 32 characters)

### 2. GMAIL_CLIENT_ID
Your Google OAuth client ID

### 3. GMAIL_CLIENT_SECRET
Your Google OAuth client secret

---

## How to Set Environment Variables

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/settings/functions

2. Scroll to **"Environment Variables"** section

3. Click **"Add new secret"**

4. Add each variable:

   **ENCRYPTION_KEY**
   ```
   Value: [Generate a random 32+ character string]
   ```
   To generate a secure key, run in terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   **GMAIL_CLIENT_ID**
   ```
   Value: [Your Google OAuth Client ID from Google Cloud Console]
   ```

   **GMAIL_CLIENT_SECRET**
   ```
   Value: [Your Google OAuth Client Secret from Google Cloud Console]
   ```

5. Click **"Save"** for each variable

6. **Redeploy your edge functions** for changes to take effect:
   ```bash
   npx supabase functions deploy gmail-sync --project-ref pesqbkgfsfkqdquhilsv
   npx supabase functions deploy gmail-oauth --project-ref pesqbkgfsfkqdquhilsv
   npx supabase functions deploy gmail-webhook --project-ref pesqbkgfsfkqdquhilsv
   ```

---

### Option 2: Via Supabase CLI

Create a `.env` file in your project root with:

```bash
ENCRYPTION_KEY=your_32_char_or_longer_random_string_here
GMAIL_CLIENT_ID=your_google_client_id
GMAIL_CLIENT_SECRET=your_google_client_secret
```

Then deploy with:
```bash
npx supabase secrets set --env-file .env
```

---

## Where to Find Your Google OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your OAuth 2.0 Client ID (the one you used for Gmail integration)

3. Click on it to see:
   - **Client ID** → Use for `GMAIL_CLIENT_ID`
   - **Client secret** → Use for `GMAIL_CLIENT_SECRET`

---

## Generate a Secure Encryption Key

Run one of these commands to generate a secure 32+ character key:

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Online:**
https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new

---

## After Setting Variables

1. **Redeploy the functions** (they need to restart to pick up new environment variables)

2. **Test the sync again:**
   - Go to http://localhost:8080/inbox
   - Click "Sync Gmail"
   - Should work now! ✅

---

## Verify Variables Are Set

Run this command to check:
```bash
npx supabase secrets list
```

You should see:
- ENCRYPTION_KEY
- GMAIL_CLIENT_ID
- GMAIL_CLIENT_SECRET

If any are missing, add them using the steps above.
