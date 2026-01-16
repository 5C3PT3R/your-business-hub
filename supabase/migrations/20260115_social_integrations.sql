-- Social Integrations Module
-- Enables Omnichannel Inbox: WhatsApp, Meta (Facebook/Instagram), LinkedIn

-- Social Connections Table - Stores OAuth tokens and platform-specific settings
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,

  -- Platform Info
  platform VARCHAR(30) NOT NULL CHECK (platform IN (
    'whatsapp', 'messenger', 'instagram', 'linkedin'
  )),
  platform_account_id TEXT NOT NULL, -- WABA ID, Page ID, etc.
  platform_account_name TEXT,

  -- OAuth Credentials (encrypted in practice)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- WhatsApp Specific
  phone_number_id TEXT,
  whatsapp_business_id TEXT,

  -- Meta Specific (Facebook/Instagram)
  page_id TEXT,
  page_name TEXT,
  instagram_account_id TEXT,

  -- LinkedIn Specific
  linkedin_urn TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'disconnected', 'expired', 'error'
  )),
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,

  -- Webhook Config
  webhook_verified BOOLEAN DEFAULT FALSE,
  webhook_secret TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, platform, platform_account_id)
);

-- WhatsApp Templates Table - Pre-approved HSM templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE CASCADE NOT NULL,

  -- Template Info
  template_id TEXT NOT NULL, -- Meta template ID
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  category VARCHAR(30) CHECK (category IN (
    'authentication', 'marketing', 'utility'
  )),

  -- Content
  header_type VARCHAR(20) CHECK (header_type IN ('text', 'image', 'video', 'document')),
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,

  -- Variables/Parameters
  variables JSONB DEFAULT '[]'::JSONB, -- [{name: 'customer_name', example: 'John'}]

  -- Buttons
  buttons JSONB DEFAULT '[]'::JSONB,

  -- Status from Meta
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'paused', 'disabled'
  )),
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(connection_id, template_id)
);

-- Social Conversations - Extends conversations for social messaging
CREATE TABLE IF NOT EXISTS public.social_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Platform identifiers
  platform VARCHAR(30) NOT NULL,
  platform_conversation_id TEXT NOT NULL, -- wa_id, psid, etc.
  platform_user_id TEXT, -- Sender's platform ID
  platform_user_name TEXT,
  platform_user_avatar TEXT,

  -- WhatsApp 24-hour session tracking
  session_expires_at TIMESTAMPTZ, -- When the 24h window closes
  requires_template BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'archived', 'blocked'
  )),

  -- Counts
  message_count INT DEFAULT 0,
  unread_count INT DEFAULT 0,

  -- Last activity
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ, -- For 24h window calculation

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(connection_id, platform_conversation_id)
);

-- Social Messages - Individual messages from social platforms
CREATE TABLE IF NOT EXISTS public.social_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.social_conversations(id) ON DELETE CASCADE NOT NULL,

  -- Platform identifiers
  platform VARCHAR(30) NOT NULL,
  external_id TEXT NOT NULL, -- Message ID from platform (mid)

  -- Message content
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'video', 'audio', 'document', 'sticker',
    'location', 'contact', 'template', 'interactive', 'reaction', 'story_reply'
  )),

  -- Content
  body TEXT,
  caption TEXT, -- For media messages

  -- Media attachments
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  media_size INT,

  -- Template info (if sent via template)
  template_id UUID REFERENCES public.whatsapp_templates(id),
  template_variables JSONB,

  -- Delivery status (WhatsApp)
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN (
    'pending', 'sent', 'delivered', 'read', 'failed'
  )),
  status_updated_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,

  -- Context (for replies/reactions)
  reply_to_id UUID REFERENCES public.social_messages(id),
  reaction_emoji TEXT,

  -- Source context (for Meta)
  source_page_name TEXT, -- "Via Acme Corp FB Page"

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Sync
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(conversation_id, external_id)
);

-- Webhook Events Log - For debugging and replay
CREATE TABLE IF NOT EXISTS public.social_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE SET NULL,

  -- Event info
  platform VARCHAR(30) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- messages, message_status, etc.

  -- Raw payload
  payload JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INT DEFAULT 0,

  -- Metadata
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_connections_workspace ON social_connections(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_status ON social_connections(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_connection ON whatsapp_templates(connection_id, status);
CREATE INDEX IF NOT EXISTS idx_social_conversations_workspace ON social_conversations(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_conversations_contact ON social_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_social_conversations_session ON social_conversations(session_expires_at) WHERE requires_template = FALSE;
CREATE INDEX IF NOT EXISTS idx_social_messages_conversation ON social_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_status ON social_messages(status) WHERE direction = 'outbound';
CREATE INDEX IF NOT EXISTS idx_social_webhook_events_unprocessed ON social_webhook_events(platform, processed) WHERE processed = FALSE;

-- Enable RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can manage their social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can view whatsapp templates" ON whatsapp_templates;
DROP POLICY IF EXISTS "Users can view social conversations" ON social_conversations;
DROP POLICY IF EXISTS "Users can view social messages" ON social_messages;

-- RLS Policies
CREATE POLICY "Users can view their social connections" ON social_connections
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their social connections" ON social_connections
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view whatsapp templates" ON whatsapp_templates
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view social conversations" ON social_conversations
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view social messages" ON social_messages
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Function to update session expiry on inbound message
CREATE OR REPLACE FUNCTION update_whatsapp_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'inbound' AND NEW.platform = 'whatsapp' THEN
    UPDATE social_conversations
    SET
      session_expires_at = NOW() + INTERVAL '24 hours',
      requires_template = FALSE,
      last_inbound_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_whatsapp_session ON social_messages;
CREATE TRIGGER trg_update_whatsapp_session
  AFTER INSERT ON social_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_session();

-- Function to check if session expired and mark requires_template
CREATE OR REPLACE FUNCTION check_whatsapp_session_expired()
RETURNS void AS $$
BEGIN
  UPDATE social_conversations
  SET requires_template = TRUE
  WHERE platform = 'whatsapp'
    AND session_expires_at < NOW()
    AND requires_template = FALSE;
END;
$$ LANGUAGE plpgsql;
