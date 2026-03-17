-- REGENT: Knight RAG — pgvector knowledge base
-- Multi-tenant vector knowledge base for Knight's anti-hallucination RAG system.
-- Global rows (client_id IS NULL) = Bitext base dataset.
-- Per-client rows (client_id IS NOT NULL) = client-specific product/support docs.

-- ─── Enable pgvector ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knight_knowledge_base (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id UUID,                          -- workspace-scoped entries (nullable)
  content      TEXT        NOT NULL,          -- the support Q/A or knowledge chunk
  category     TEXT,                          -- e.g. 'billing', 'account', 'technical'
  intent       TEXT,                          -- e.g. 'cancel_order', 'reset_password'
  source       TEXT        DEFAULT 'bitext',  -- 'bitext' | 'custom' | 'upload'
  embedding    vector(1536),                  -- OpenAI text-embedding-3-small
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- HNSW for fast approximate cosine similarity (better than ivfflat for cold starts)
CREATE INDEX IF NOT EXISTS idx_knight_kb_embedding
  ON public.knight_knowledge_base
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_knight_kb_workspace
  ON public.knight_knowledge_base (workspace_id);

CREATE INDEX IF NOT EXISTS idx_knight_kb_client
  ON public.knight_knowledge_base (client_id);

CREATE INDEX IF NOT EXISTS idx_knight_kb_category
  ON public.knight_knowledge_base (category);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.knight_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read global rows + their own workspace's rows
CREATE POLICY "Users can read global and workspace knowledge"
  ON public.knight_knowledge_base
  FOR SELECT
  USING (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = knight_knowledge_base.workspace_id
        AND w.user_id = auth.uid()
    )
  );

-- Service role (edge functions) bypass RLS automatically

-- ─── match_knowledge RPC ──────────────────────────────────────────────────────
-- Called by knight-webhook to retrieve context before generating a response.
-- Returns rows ordered by cosine similarity DESC, filtered by threshold.
-- p_workspace_id: searches global (NULL) + workspace-specific rows.
-- Uses cosine distance operator <=> (1 - similarity = distance).

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.75,
  match_count      int     DEFAULT 5,
  p_workspace_id   uuid    DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  content     text,
  category    text,
  intent      text,
  similarity  float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.category,
    kb.intent,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knight_knowledge_base kb
  WHERE
    kb.embedding IS NOT NULL
    AND (kb.workspace_id IS NULL OR kb.workspace_id = p_workspace_id)
    AND 1 - (kb.embedding <=> query_embedding) >= match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
