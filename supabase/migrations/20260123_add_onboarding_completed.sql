-- Add onboarding_completed column to profiles table
-- This is used by the AuthGuard to determine if user needs to complete onboarding

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Whether user has completed the onboarding wizard';

-- Update the handle_new_user trigger to include onboarding_completed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, is_active, subscription_tier, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    TRUE,
    'free',
    FALSE  -- New users need to complete onboarding
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;
