-- Waitlist table for early access applications
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  industry TEXT,
  company_size TEXT,
  ops_team_size TEXT,
  function_interest TEXT,
  bottleneck TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Allow anonymous inserts (landing page visitors aren't authenticated)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read the waitlist
CREATE POLICY "Authenticated users can read waitlist"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (true);
