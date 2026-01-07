-- Gmail Integration Schema with Security
-- Created: 2026-01-07

-- OAuth tokens table with encryption
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('gmail', 'instagram', 'facebook')),
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_iv TEXT NOT NULL, -- Initialization vector for AES-GCM
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  encryption_key_version INT DEFAULT 1,
  scopes TEXT[] NOT NULL, -- Array of granted scopes
  email_address VARCHAR(255), -- User's Gmail address
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, channel)
);

-- Indexes for performance
CREATE INDEX idx_oauth_tokens_user_channel ON oauth_tokens(user_id, channel);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at) WHERE expires_at < NOW() + INTERVAL '1 hour';

-- Row-level security
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Message deduplication table
CREATE TABLE IF NOT EXISTS message_dedup (
  dedup_key VARCHAR(255) PRIMARY KEY,
  channel VARCHAR(50) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  lead_id UUID,
  activity_id UUID,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for cleanup job
CREATE INDEX idx_message_dedup_expires ON message_dedup(expires_at);

-- Audit log for all security-critical actions
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL, -- 'oauth_connected', 'email_sent', 'token_refreshed', 'email_draft_approved', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'oauth_token', 'email', 'activity', etc.
  entity_id UUID,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by VARCHAR(50) NOT NULL, -- 'user', 'ai', 'system'
  ip_address INET,
  user_agent TEXT,
  changes JSONB, -- Before/after state
  metadata JSONB, -- Additional context
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_risk ON audit_log(risk_level, created_at DESC) WHERE risk_level IN ('high', 'critical');

-- RLS for audit log (users can only see their own)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admin policy (you'll need to create an admin role)
CREATE POLICY "Service role can manage audit logs"
  ON audit_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Rate limiting table (track API usage)
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint VARCHAR(100) NOT NULL,
  request_count INT DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_request_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_user_endpoint ON rate_limits(user_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_blocked ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Email send approval queue (human-in-the-loop)
CREATE TABLE IF NOT EXISTS email_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  to_address VARCHAR(255) NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  draft_source VARCHAR(50) DEFAULT 'ai' CHECK (draft_source IN ('ai', 'user', 'template')),
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'failed')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  gmail_message_id VARCHAR(255), -- Resulting message ID after send
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_queue_user_status ON email_send_queue(user_id, status);
CREATE INDEX idx_email_queue_pending ON email_send_queue(created_at DESC) WHERE status = 'pending';

-- RLS for email queue
ALTER TABLE email_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email queue"
  ON email_send_queue FOR ALL
  USING (auth.uid() = user_id);

-- Function to clean up expired deduplication keys (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_dedup_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM message_dedup WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_send_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add columns to existing activities table for Gmail integration
ALTER TABLE activities ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS external_thread_id VARCHAR(255);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS channel VARCHAR(50) CHECK (channel IN ('email', 'call', 'meeting', 'note', 'gmail', 'instagram', 'facebook'));
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Index for finding activities by external ID (dedup check)
CREATE INDEX IF NOT EXISTS idx_activities_external_id ON activities(channel, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_thread ON activities(external_thread_id) WHERE external_thread_id IS NOT NULL;

-- Security: Prevent SQL injection in dynamic queries
COMMENT ON TABLE oauth_tokens IS 'Stores encrypted OAuth tokens for external integrations. Never log or expose token values.';
COMMENT ON TABLE audit_log IS 'Immutable audit trail. Never delete records except for GDPR compliance.';
COMMENT ON TABLE email_send_queue IS 'Human approval required before AI-generated emails are sent.';

-- Grant necessary permissions to service role
GRANT ALL ON oauth_tokens TO service_role;
GRANT ALL ON message_dedup TO service_role;
GRANT ALL ON audit_log TO service_role;
GRANT ALL ON rate_limits TO service_role;
GRANT ALL ON email_send_queue TO service_role;
