-- REGENT: Additional index on rook_reply_logs for dashboard intent queries
-- Allows efficient filtering by intent_classification without full table scan.

CREATE INDEX IF NOT EXISTS idx_rook_reply_logs_intent
  ON public.rook_reply_logs (intent_classification);
