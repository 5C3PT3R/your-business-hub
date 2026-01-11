-- Create conversations table for omnichannel inbox
-- Unified view of all communications across channels

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Related entities
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Channel & type
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'linkedin', 'whatsapp', 'call', 'sms', 'twitter')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Content
  subject TEXT,
  body TEXT,
  plain_text TEXT, -- Plain text version for search
  html_body TEXT, -- HTML version for display

  -- Participants
  from_email VARCHAR(255),
  from_name TEXT,
  to_emails TEXT[], -- Array of recipient emails
  cc_emails TEXT[],
  bcc_emails TEXT[],

  -- External IDs (for syncing)
  external_id VARCHAR(255), -- Gmail message ID, LinkedIn message ID, etc.
  external_thread_id VARCHAR(255), -- For threading conversations

  -- AI Analysis
  sentiment VARCHAR(20) CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  sentiment_score DECIMAL(5, 2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  ai_summary TEXT, -- AI-generated summary
  intent VARCHAR(50), -- buying_signal, question, objection, thanks, etc.
  topics TEXT[], -- Extracted topics/keywords
  next_action_suggested TEXT, -- AI suggested next action

  -- Status & flags
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_ai_flagged BOOLEAN DEFAULT FALSE, -- AI detected something important
  requires_response BOOLEAN DEFAULT TRUE,

  -- Response tracking
  response_due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_time_hours DECIMAL(10, 2), -- Time to respond in hours

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachments JSONB DEFAULT '[]',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  raw_data JSONB, -- Store original API response

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_channel ON conversations(user_id, channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_deal ON conversations(deal_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(external_thread_id) WHERE external_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_external_id ON conversations(channel, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_conversations_urgent ON conversations(user_id, is_urgent) WHERE is_urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversations_search ON conversations USING gin(to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(plain_text, '')));

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate response time
CREATE OR REPLACE FUNCTION calculate_response_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.responded_at IS NOT NULL AND OLD.responded_at IS NULL THEN
    NEW.response_time_hours := EXTRACT(EPOCH FROM (NEW.responded_at - NEW.sent_at)) / 3600;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_conversation_response_time
  BEFORE UPDATE OF responded_at ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_response_time();

-- Comments
COMMENT ON TABLE conversations IS 'Omnichannel conversations - unified inbox for email, LinkedIn, WhatsApp, calls';
COMMENT ON COLUMN conversations.sentiment_score IS 'AI sentiment score: -1 (very negative) to +1 (very positive)';
COMMENT ON COLUMN conversations.intent IS 'AI-detected intent: buying_signal, question, objection, thanks, etc.';
