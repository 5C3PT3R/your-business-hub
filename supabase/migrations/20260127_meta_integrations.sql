-- =====================================================
-- META API INTEGRATIONS
-- =====================================================
-- Stores Meta (Facebook, Instagram, WhatsApp) API credentials
-- and connection status for each workspace.

-- =====================================================
-- 1. META INTEGRATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- App Credentials (encrypted in production)
  app_id TEXT NOT NULL,
  app_secret TEXT, -- Should be stored encrypted or in env vars

  -- OAuth Tokens
  access_token TEXT, -- Long-lived user access token
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT,

  -- Connected Assets
  facebook_user_id TEXT,
  facebook_user_name TEXT,

  -- Connection Status
  is_connected BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  connection_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One integration per workspace
  UNIQUE(workspace_id)
);

-- =====================================================
-- 2. META PAGES TABLE (Facebook & Instagram Pages)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Page Info
  page_id TEXT NOT NULL, -- Facebook Page ID
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  page_category TEXT,
  page_picture_url TEXT,

  -- Instagram Business Account (if connected)
  instagram_account_id TEXT,
  instagram_username TEXT,

  -- Permissions
  has_lead_access BOOLEAN DEFAULT false,
  has_messaging_access BOOLEAN DEFAULT false,
  has_posting_access BOOLEAN DEFAULT false,
  has_ads_access BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(integration_id, page_id)
);

-- =====================================================
-- 3. META AD ACCOUNTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ad Account Info
  ad_account_id TEXT NOT NULL, -- Format: act_XXXXXXXX
  account_name TEXT,
  account_status INTEGER, -- 1=Active, 2=Disabled, etc.
  currency TEXT DEFAULT 'USD',
  timezone_name TEXT,
  business_name TEXT,
  business_id TEXT,

  -- Spending
  amount_spent DECIMAL(15, 2) DEFAULT 0,
  spend_cap DECIMAL(15, 2),
  daily_spend_limit DECIMAL(15, 2),

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(integration_id, ad_account_id)
);

-- =====================================================
-- 4. META LEAD FORMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_lead_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.meta_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Form Info
  form_id TEXT NOT NULL, -- Facebook Lead Form ID
  form_name TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, DELETED
  leads_count INTEGER DEFAULT 0,

  -- Configuration
  auto_import_leads BOOLEAN DEFAULT true,
  notify_on_new_lead BOOLEAN DEFAULT true,

  -- Field Mapping (maps FB fields to our lead fields)
  field_mapping JSONB DEFAULT '{}'::jsonb,
  -- Example: {"email": "email", "full_name": "name", "phone_number": "phone"}

  -- Webhook
  webhook_subscribed BOOLEAN DEFAULT false,
  last_lead_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(page_id, form_id)
);

-- =====================================================
-- 5. META WHATSAPP ACCOUNTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- WhatsApp Business Account
  waba_id TEXT NOT NULL, -- WhatsApp Business Account ID
  waba_name TEXT,

  -- Phone Numbers
  phone_number_id TEXT, -- Primary phone number ID
  display_phone_number TEXT, -- e.g., +1 555 123 4567
  verified_name TEXT,
  quality_rating TEXT, -- GREEN, YELLOW, RED

  -- Messaging Limits
  messaging_limit TEXT, -- TIER_1K, TIER_10K, TIER_100K, UNLIMITED
  current_throughput INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(integration_id, waba_id)
);

-- =====================================================
-- 6. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_meta_integrations_user ON public.meta_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_workspace ON public.meta_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_integration ON public.meta_pages(integration_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_page_id ON public.meta_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_integration ON public.meta_ad_accounts(integration_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_page ON public.meta_lead_forms(page_id);
CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_integration ON public.meta_whatsapp_accounts(integration_id);

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

-- Meta Integrations RLS
DROP POLICY IF EXISTS "Users can read own integrations" ON public.meta_integrations;
CREATE POLICY "Users can read own integrations"
ON public.meta_integrations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON public.meta_integrations;
CREATE POLICY "Users can insert own integrations"
ON public.meta_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON public.meta_integrations;
CREATE POLICY "Users can update own integrations"
ON public.meta_integrations FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own integrations" ON public.meta_integrations;
CREATE POLICY "Users can delete own integrations"
ON public.meta_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Meta Pages RLS
DROP POLICY IF EXISTS "Users can manage own pages" ON public.meta_pages;
CREATE POLICY "Users can manage own pages"
ON public.meta_pages FOR ALL
USING (auth.uid() = user_id);

-- Meta Ad Accounts RLS
DROP POLICY IF EXISTS "Users can manage own ad accounts" ON public.meta_ad_accounts;
CREATE POLICY "Users can manage own ad accounts"
ON public.meta_ad_accounts FOR ALL
USING (auth.uid() = user_id);

-- Meta Lead Forms RLS
DROP POLICY IF EXISTS "Users can manage own lead forms" ON public.meta_lead_forms;
CREATE POLICY "Users can manage own lead forms"
ON public.meta_lead_forms FOR ALL
USING (auth.uid() = user_id);

-- Meta WhatsApp RLS
DROP POLICY IF EXISTS "Users can manage own whatsapp" ON public.meta_whatsapp_accounts;
CREATE POLICY "Users can manage own whatsapp"
ON public.meta_whatsapp_accounts FOR ALL
USING (auth.uid() = user_id);

-- =====================================================
-- 8. TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_integrations_updated_at ON public.meta_integrations;
CREATE TRIGGER update_meta_integrations_updated_at
  BEFORE UPDATE ON public.meta_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

DROP TRIGGER IF EXISTS update_meta_pages_updated_at ON public.meta_pages;
CREATE TRIGGER update_meta_pages_updated_at
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

DROP TRIGGER IF EXISTS update_meta_ad_accounts_updated_at ON public.meta_ad_accounts;
CREATE TRIGGER update_meta_ad_accounts_updated_at
  BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

DROP TRIGGER IF EXISTS update_meta_lead_forms_updated_at ON public.meta_lead_forms;
CREATE TRIGGER update_meta_lead_forms_updated_at
  BEFORE UPDATE ON public.meta_lead_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

DROP TRIGGER IF EXISTS update_meta_whatsapp_updated_at ON public.meta_whatsapp_accounts;
CREATE TRIGGER update_meta_whatsapp_updated_at
  BEFORE UPDATE ON public.meta_whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

-- =====================================================
-- 9. COMMENTS
-- =====================================================
COMMENT ON TABLE public.meta_integrations IS 'Meta API integration credentials and connection status per workspace';
COMMENT ON TABLE public.meta_pages IS 'Connected Facebook Pages and Instagram Business accounts';
COMMENT ON TABLE public.meta_ad_accounts IS 'Meta Ads Manager accounts for campaign management';
COMMENT ON TABLE public.meta_lead_forms IS 'Facebook Lead Ad forms for lead capture';
COMMENT ON TABLE public.meta_whatsapp_accounts IS 'WhatsApp Business API accounts for messaging';
