-- =====================================================
-- META WHATSAPP ACCOUNTS TABLE & RPC FUNCTIONS
-- =====================================================
-- Creates the meta_whatsapp_accounts table if it doesn't exist
-- and adds RPC functions to bypass PostgREST schema cache issues

-- =====================================================
-- 0. CREATE TRIGGER FUNCTION IF NOT EXISTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. CREATE TABLE IF NOT EXISTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- WhatsApp Business Account
  waba_id TEXT NOT NULL,
  waba_name TEXT,

  -- Phone Numbers
  phone_number_id TEXT,
  display_phone_number TEXT,
  verified_name TEXT,
  quality_rating TEXT,

  -- Messaging Limits
  messaging_limit TEXT,
  current_throughput INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(integration_id, waba_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_meta_whatsapp_integration ON public.meta_whatsapp_accounts(integration_id);

-- RLS
ALTER TABLE public.meta_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own whatsapp" ON public.meta_whatsapp_accounts;
CREATE POLICY "Users can manage own whatsapp"
ON public.meta_whatsapp_accounts FOR ALL
USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_meta_whatsapp_updated_at ON public.meta_whatsapp_accounts;
CREATE TRIGGER update_meta_whatsapp_updated_at
  BEFORE UPDATE ON public.meta_whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_updated_at();

-- =====================================================
-- 2. SAVE META WHATSAPP ACCOUNT
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_meta_whatsapp_account(
  p_integration_id UUID,
  p_user_id UUID,
  p_waba_id TEXT,
  p_waba_name TEXT DEFAULT NULL,
  p_phone_number_id TEXT DEFAULT NULL,
  p_display_phone_number TEXT DEFAULT NULL,
  p_verified_name TEXT DEFAULT NULL,
  p_quality_rating TEXT DEFAULT NULL,
  p_messaging_limit TEXT DEFAULT NULL
)
RETURNS SETOF public.meta_whatsapp_accounts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns the integration
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_integrations
    WHERE id = p_integration_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not own this integration';
  END IF;

  RETURN QUERY
  INSERT INTO public.meta_whatsapp_accounts (
    integration_id,
    user_id,
    waba_id,
    waba_name,
    phone_number_id,
    display_phone_number,
    verified_name,
    quality_rating,
    messaging_limit,
    is_active,
    last_synced_at
  ) VALUES (
    p_integration_id,
    p_user_id,
    p_waba_id,
    p_waba_name,
    p_phone_number_id,
    p_display_phone_number,
    p_verified_name,
    p_quality_rating,
    p_messaging_limit,
    true,
    NOW()
  )
  ON CONFLICT (integration_id, waba_id) DO UPDATE SET
    waba_name = COALESCE(EXCLUDED.waba_name, meta_whatsapp_accounts.waba_name),
    phone_number_id = COALESCE(EXCLUDED.phone_number_id, meta_whatsapp_accounts.phone_number_id),
    display_phone_number = COALESCE(EXCLUDED.display_phone_number, meta_whatsapp_accounts.display_phone_number),
    verified_name = COALESCE(EXCLUDED.verified_name, meta_whatsapp_accounts.verified_name),
    quality_rating = COALESCE(EXCLUDED.quality_rating, meta_whatsapp_accounts.quality_rating),
    messaging_limit = COALESCE(EXCLUDED.messaging_limit, meta_whatsapp_accounts.messaging_limit),
    is_active = true,
    last_synced_at = NOW(),
    updated_at = NOW()
  RETURNING *;
END;
$$;

-- =====================================================
-- 3. GET META WHATSAPP ACCOUNTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_meta_whatsapp_accounts(
  p_integration_id UUID
)
RETURNS SETOF public.meta_whatsapp_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.meta_whatsapp_accounts
  WHERE integration_id = p_integration_id
    AND is_active = true
  ORDER BY created_at DESC;
$$;

-- =====================================================
-- 4. DELETE META WHATSAPP ACCOUNT
-- =====================================================
CREATE OR REPLACE FUNCTION public.delete_meta_whatsapp_account(
  p_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.meta_whatsapp_accounts
  SET is_active = false, updated_at = NOW()
  WHERE id = p_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- 5. GRANT EXECUTE PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.save_meta_whatsapp_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_whatsapp_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_meta_whatsapp_account TO authenticated;
