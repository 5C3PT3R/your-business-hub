-- =====================================================
-- Enable Supabase Realtime for Knight tables
-- This allows the dashboard to auto-refresh when new messages arrive
-- =====================================================

-- Add tickets and ticket_messages to the realtime publication
-- so that Supabase client subscriptions (postgres_changes) work
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
