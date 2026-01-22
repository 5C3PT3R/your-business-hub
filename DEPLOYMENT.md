# Vercel Deployment Guide

This guide will help you deploy Your Business Hub to Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- A GitHub account (recommended for automatic deployments)
- Your Supabase credentials
- Your API keys (Gmail, OpenAI, etc.)

## Step 1: Prepare Your Repository

1. Make sure all your changes are committed to git:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   ```

2. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the Vite framework
5. Configure your project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

### Required Variables (Frontend)
```
VITE_SUPABASE_URL=https://pesqbkgfsfkqdquhilsv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

### Optional Variables (if using features)
```
VITE_OPENAI_API_KEY=your_openai_key_here
```

**Important Notes:**
- Only add variables prefixed with `VITE_` for the frontend
- Backend variables (Gmail OAuth, Twilio, etc.) should be configured in Supabase Edge Functions
- Never commit sensitive keys to your repository

## Step 4: Configure Supabase Edge Functions

Your Supabase Edge Functions need their own environment variables:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → Edge Functions**
4. Add these variables:

```
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
ENCRYPTION_KEY=your_32_character_hex_key
SUPABASE_URL=https://pesqbkgfsfkqdquhilsv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
TWILIO_ACCOUNT_SID=your_twilio_sid (optional)
TWILIO_AUTH_TOKEN=your_twilio_token (optional)
TWILIO_PHONE_NUMBER=your_twilio_number (optional)
```

## Step 5: Update OAuth Redirect URLs

After deployment, update your OAuth redirect URLs:

### Gmail OAuth (Google Cloud Console)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services → Credentials**
4. Edit your OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   ```
   https://your-app.vercel.app
   https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/gmail-oauth/callback
   ```

### Supabase Authentication
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel URL to **Site URL**: `https://your-app.vercel.app`
3. Add to **Redirect URLs**: `https://your-app.vercel.app/**`

## Step 6: Deploy Supabase Functions

Deploy your Edge Functions to Supabase:

```bash
cd supabase
npx supabase functions deploy gmail-oauth
npx supabase functions deploy gmail-webhook
```

## Step 7: Verify Deployment

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test authentication
3. Test Gmail integration
4. Check all features are working

## Automatic Deployments

Vercel will automatically deploy:
- **Production**: When you push to `main` branch
- **Preview**: For pull requests and other branches

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure TypeScript has no errors: `npm run lint`

### Environment Variables Not Working
- Make sure variables are prefixed with `VITE_` for frontend
- Redeploy after adding new variables
- Check variable names match exactly

### Authentication Issues
- Verify Supabase URL and keys are correct
- Check redirect URLs in Supabase dashboard
- Ensure Edge Functions are deployed

### Gmail Integration Not Working
- Verify Edge Function environment variables
- Check OAuth credentials in Google Cloud Console
- Ensure redirect URIs are updated

## Production Checklist

- [ ] All environment variables configured in Vercel
- [ ] Supabase Edge Functions deployed
- [ ] OAuth redirect URLs updated
- [ ] Site URL updated in Supabase
- [ ] Test authentication flow
- [ ] Test Gmail integration
- [ ] Test all core features
- [ ] Monitor error logs in Vercel dashboard

---

## Day 7: Production Deployment Additions

### Bishop Edge Function

Deploy the Bishop sweep Edge Function for production:

```bash
npx supabase functions deploy bishop-sweep
```

Set required secrets:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-xxx
npx supabase secrets set LLM_PROVIDER=openai
```

### Database Migrations (Day 4-6)

Run these SQL migrations in Supabase Dashboard → SQL Editor:

**Day 4: Bishop Leads**
```sql
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bishop_status TEXT DEFAULT 'INTRO_SENT';
```

**Day 5: AI Drafts**
```sql
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
```

**Day 6: Subscription Gating**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
```

### Verification Script

Run the production verification script:
```bash
npx tsx scripts/verify-production.ts
```

### Day 7 Checklist

- [ ] Git repo pushed to GitHub
- [ ] Vercel connected and building
- [ ] Bishop Edge Function deployed
- [ ] All Day 4-6 migrations applied
- [ ] Domain configured (HTTPS active)
- [ ] Verification script passes
- [ ] Can log in from fresh browser
- [ ] Bishop runs without localhost
- [ ] Drafts appear in Command Center

## Useful Commands

```bash
# Redeploy to production
vercel --prod

# View deployment logs
vercel logs

# List deployments
vercel ls

# Open project in browser
vercel open
```

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)

## Security Notes

1. Never commit `.env` files to git
2. Rotate keys if accidentally exposed
3. Use environment variables for all secrets
4. Enable Vercel's security headers
5. Keep dependencies updated

---

**Your deployment is ready!** Visit your Vercel dashboard to see your live application.
