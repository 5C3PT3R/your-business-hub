-- Tighten waitlist RLS: all access now handled via submit-waitlist Edge Function
-- Edge Function uses service_role key (bypasses RLS), so anon INSERT is no longer needed

-- Remove SELECT access (no user should read the full waitlist list)
DROP POLICY IF EXISTS "Authenticated users can read waitlist" ON public.waitlist;

-- Remove anon INSERT access (Edge Function handles inserts via service_role after Turnstile verification)
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
