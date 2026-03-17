-- REGENT: rook_reply_logs table + bishop_lead_status enum extension
-- Stores every classified email reply processed by rook-reply.
-- Provides full audit trail of intent classifications and CRM enrichment.

-- ─── Ensure bishop_lead_status enum exists with all required values ────────────
-- Guards against the case where the type was never applied to prod.
-- Creates the full enum if missing; adds only new values if it already exists.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'bishop_lead_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.bishop_lead_status AS ENUM (
      'INTRO_SENT',
      'FOLLOW_UP_NEEDED',
      'NUDGE_SENT',
      'BREAKUP_SENT',
      'ESCALATE_TO_KING',
      'MEETING_PENDING',
      'DNC',
      'REVIEW_NEEDED'
    );
  END IF;
END $$;

-- Add new values if type already existed without them.
-- ALTER TYPE ADD VALUE cannot run inside a transaction block — must be top-level.
ALTER TYPE public.bishop_lead_status ADD VALUE IF NOT EXISTS 'MEETING_PENDING';
ALTER TYPE public.bishop_lead_status ADD VALUE IF NOT EXISTS 'DNC';
ALTER TYPE public.bishop_lead_status ADD VALUE IF NOT EXISTS 'REVIEW_NEEDED';

CREATE TABLE IF NOT EXISTS public.rook_reply_logs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                 UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_body              TEXT        NOT NULL,
  intent_classification   TEXT        NOT NULL
    CHECK (intent_classification IN (
      'positive_meeting', 'objection_pricing', 'objection_timing',
      'unsubscribe', 'information_request', 'not_interested'
    )),
  classification_confidence FLOAT     NOT NULL CHECK (classification_confidence BETWEEN 0 AND 1),
  extracted_phone         TEXT,
  extracted_title         TEXT,
  suggested_next_state    TEXT        NOT NULL
    CHECK (suggested_next_state IN ('meeting_pending', 'dnc_list', 'needs_rebuttal')),
  bishop_status_before    TEXT,
  bishop_status_after     TEXT,
  confidence_gate_passed  BOOLEAN     NOT NULL DEFAULT true,
  idempotency_key         TEXT        UNIQUE,  -- SHA-256(lead_id + body[:200]) prevents double-processing
  processed_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by lead
CREATE INDEX IF NOT EXISTS idx_rook_reply_logs_lead_id
  ON public.rook_reply_logs (lead_id);

-- Index for dashboard queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_rook_reply_logs_created_at
  ON public.rook_reply_logs (created_at DESC);

-- RLS: authenticated users can read reply logs for their workspace's leads
ALTER TABLE public.rook_reply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reply logs for their leads"
  ON public.rook_reply_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = rook_reply_logs.lead_id
        AND l.user_id = auth.uid()
    )
  );

-- Service role (edge functions) bypass RLS
