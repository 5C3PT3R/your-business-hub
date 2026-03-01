-- ─────────────────────────────────────────────────────────
-- REGENT BPO SCHEMA
-- Migration: 20260302_bpo_clients_schema.sql
--
-- Adds multi-tenant client management for the BPO platform.
-- Existing workspace/lead/ticket data is unaffected (nullable FKs).
-- ─────────────────────────────────────────────────────────

-- 1. CLIENTS — one row per business Regent serves
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name          TEXT NOT NULL,
  industry      TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  website       TEXT,

  -- Bishop (outbound SDR) config
  bishop_enabled        BOOLEAN DEFAULT false,
  bishop_value_prop     TEXT,
  bishop_tone           TEXT DEFAULT 'professional',
  bishop_sender_name    TEXT,
  bishop_sender_email   TEXT,
  bishop_gmail_user_id  TEXT,   -- links to gmail oauth row
  bishop_follow_up_days INT DEFAULT 3,
  bishop_daily_limit    INT DEFAULT 50,

  -- Knight (support) config
  knight_enabled         BOOLEAN DEFAULT false,
  knight_tone            TEXT DEFAULT 'friendly',
  knight_policies        TEXT,
  knight_handoff_email   TEXT,
  knight_whatsapp_number TEXT,

  -- Rook (CRM sync) config
  rook_enabled  BOOLEAN DEFAULT false,
  rook_crm_type TEXT CHECK (rook_crm_type IN ('salesforce', 'zoho', 'hubspot', 'pipedrive')),
  rook_crm_creds JSONB DEFAULT '{}',   -- encrypted in prod via vault

  -- Reporting / Queen
  slack_webhook_url TEXT,

  -- Which Regent workspace manages this client
  regent_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,

  -- Status / billing
  status TEXT DEFAULT 'pilot' CHECK (status IN ('pilot', 'active', 'paused', 'churned')),
  pilot_start_date DATE,
  pilot_end_date   DATE,
  plan TEXT DEFAULT 'pilot' CHECK (plan IN ('pilot', 'starter', 'growth', 'enterprise')),

  config     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage their clients"
ON public.clients FOR ALL
USING (
  regent_workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

CREATE INDEX idx_clients_workspace ON public.clients(regent_workspace_id);


-- 2. Add client_id to leads (nullable — existing rows unaffected)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id)
  WHERE client_id IS NOT NULL;


-- 3. Add client_id to tickets (nullable — existing rows unaffected)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id)
  WHERE client_id IS NOT NULL;


-- 4. ROOK CRM SYNC LOG — tracks every entity synced to an external CRM
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rook_crm_syncs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('lead', 'ticket', 'deal')),
  entity_id     UUID NOT NULL,
  crm_type      TEXT NOT NULL,
  crm_record_id TEXT,
  sync_status   TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  error_msg     TEXT,
  payload       JSONB DEFAULT '{}',
  synced_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rook_crm_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can view rook syncs"
ON public.rook_crm_syncs FOR ALL
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    JOIN public.workspaces w ON w.id = c.regent_workspace_id
    WHERE w.owner_id = auth.uid()
  )
);

CREATE INDEX idx_rook_syncs_client ON public.rook_crm_syncs(client_id);
CREATE INDEX idx_rook_syncs_entity ON public.rook_crm_syncs(entity_type, entity_id);
-- Prevent double-syncing the same entity to the same CRM
CREATE UNIQUE INDEX idx_rook_syncs_unique
  ON public.rook_crm_syncs(client_id, entity_type, entity_id, crm_type);


-- 5. PAWN JOBS — tracks each scrape/verify/import batch
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pawn_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  job_type     TEXT NOT NULL CHECK (job_type IN ('scrape', 'verify', 'dedup', 'import')),
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  source_url   TEXT,
  total        INT DEFAULT 0,
  clean        INT DEFAULT 0,
  duplicates   INT DEFAULT 0,
  invalid      INT DEFAULT 0,
  error_msg    TEXT,
  result       JSONB DEFAULT '{}',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pawn_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage pawn jobs"
ON public.pawn_jobs FOR ALL
USING (
  client_id IS NULL
  OR client_id IN (
    SELECT c.id FROM public.clients c
    JOIN public.workspaces w ON w.id = c.regent_workspace_id
    WHERE w.owner_id = auth.uid()
  )
);

CREATE INDEX idx_pawn_jobs_client ON public.pawn_jobs(client_id);
CREATE INDEX idx_pawn_jobs_status ON public.pawn_jobs(status);


-- 6. Updated timestamp trigger (reuse pattern from existing tables)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
