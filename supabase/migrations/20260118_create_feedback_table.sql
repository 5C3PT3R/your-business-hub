-- Feedback Table
-- Stores user feedback, bug reports, and feature requests

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Feedback content
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'question')),
  message TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  resolution TEXT,

  -- Debug information (optional)
  debug_info JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status, created_at DESC);
CREATE INDEX idx_feedback_type ON feedback(type);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert feedback
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Trigger for updated_at
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feedback IS 'User feedback, bug reports, and feature requests';
