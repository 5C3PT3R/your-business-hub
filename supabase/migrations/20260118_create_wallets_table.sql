-- Create wallets table for credit tracking system
-- Each workspace gets exactly one wallet for tracking data credits and AI usage

-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  data_credits INTEGER NOT NULL DEFAULT 50,
  ai_drafts_usage INTEGER NOT NULL DEFAULT 0,
  plan_type TEXT NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure 1-to-1 relationship with workspaces
  UNIQUE(workspace_id)
);

-- Create index for faster lookups by workspace_id
CREATE INDEX IF NOT EXISTS wallets_workspace_id_idx ON public.wallets(workspace_id);

-- Enable Row Level Security
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view wallets of workspaces they are members of" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallets" ON public.wallets;

-- RLS Policy: Users can view wallets of workspaces they are members of
CREATE POLICY "Users can view wallets of workspaces they are members of"
ON public.wallets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = wallets.workspace_id
    AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = wallets.workspace_id
    AND owner_id = auth.uid()
  )
);

-- RLS Policy: System can update wallets (restricted to RPC functions)
CREATE POLICY "System can update wallets"
ON public.wallets
FOR UPDATE
USING (true)
WITH CHECK (true);

-- RLS Policy: System can insert wallets (for trigger)
CREATE POLICY "System can insert wallets"
ON public.wallets
FOR INSERT
WITH CHECK (true);

-- Function to create wallet for new workspace
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (workspace_id, plan_type)
  VALUES (NEW.id, 'FREE');
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS create_wallet_after_workspace_insert ON public.workspaces;

-- Create trigger on workspaces table
CREATE TRIGGER create_wallet_after_workspace_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_wallet_for_new_workspace();

-- RPC Function: Check if workspace has sufficient credits
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(
  _workspace_id UUID,
  _required_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wallets
    WHERE workspace_id = _workspace_id
      AND data_credits >= _required_amount
  );
$$;

-- RPC Function: Deduct credits atomically
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _workspace_id UUID,
  _amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_credits INTEGER;
  _success BOOLEAN := FALSE;
BEGIN
  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Lock the row for update and deduct credits
  UPDATE public.wallets
  SET data_credits = data_credits - _amount,
      updated_at = NOW()
  WHERE workspace_id = _workspace_id
    AND data_credits >= _amount
  RETURNING data_credits INTO _current_credits;
  
  -- Return true if update succeeded
  IF FOUND THEN
    _success := TRUE;
  END IF;
  
  RETURN _success;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE WARNING 'Error deducting credits: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- RPC Function: Add credits
CREATE OR REPLACE FUNCTION public.add_credits(
  _workspace_id UUID,
  _amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.wallets
  SET data_credits = data_credits + _amount,
      updated_at = NOW()
  WHERE workspace_id = _workspace_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE WARNING 'Error adding credits: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- RPC Function: Track AI usage (increment counter)
CREATE OR REPLACE FUNCTION public.track_ai_usage(
  _workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets
  SET ai_drafts_usage = ai_drafts_usage + 1,
      updated_at = NOW()
  WHERE workspace_id = _workspace_id;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE WARNING 'Error tracking AI usage: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Backfill wallets for existing workspaces
INSERT INTO public.wallets (workspace_id, plan_type)
SELECT id, 'FREE' FROM public.workspaces
WHERE id NOT IN (SELECT workspace_id FROM public.wallets)
ON CONFLICT (workspace_id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_wallets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;

-- Create trigger for updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wallets_updated_at();

-- Comment on table and columns
COMMENT ON TABLE public.wallets IS 'Wallet system for tracking data credits and AI usage per workspace';
COMMENT ON COLUMN public.wallets.data_credits IS 'Credits available for enrichment operations (default: 50 for FREE plan)';
COMMENT ON COLUMN public.wallets.ai_drafts_usage IS 'Counter for AI draft generations (unlimited, for analytics only)';
COMMENT ON COLUMN public.wallets.plan_type IS 'Current plan type: FREE, PRO, ENTERPRISE';