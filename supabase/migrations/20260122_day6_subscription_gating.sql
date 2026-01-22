-- DAY 6: THE GATE - Authentication & Subscription Gating
-- Goal: Users must log in to access Regent, unauthorized users see nothing
-- A user can pay to subscribe

-- ============================================
-- PART 1: ADD SUBSCRIPTION COLUMN TO PROFILES
-- ============================================

-- Add is_active column to profiles (subscription status)
-- Defaults to TRUE for now (can be set to FALSE for freemium model)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add subscription metadata columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ============================================
-- PART 2: UPDATE handle_new_user TRIGGER
-- ============================================

-- Update the trigger function to set default subscription values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, is_active, subscription_tier)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    TRUE,  -- New users start as active (can change to FALSE for freemium)
    'free' -- Default tier
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;

-- ============================================
-- PART 3: COMMENTS FOR CLARITY
-- ============================================

COMMENT ON COLUMN public.profiles.is_active IS 'Subscription status: TRUE = can access app, FALSE = needs to subscribe';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription tier: free, starter, pro, enterprise';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'When the subscription expires (NULL = no expiry)';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for payment processing';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT id, email, is_active, subscription_tier FROM profiles;
