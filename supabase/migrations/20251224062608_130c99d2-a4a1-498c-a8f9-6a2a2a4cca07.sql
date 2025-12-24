-- Create call_logs table to store call recordings, transcriptions, and analysis
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcription TEXT,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_score NUMERIC(3,2),
  follow_ups JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  key_topics JSONB DEFAULT '[]'::jsonb,
  twilio_call_sid TEXT,
  call_status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their workspace call logs" 
ON public.call_logs 
FOR SELECT 
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create call logs in their workspace" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update their workspace call logs" 
ON public.call_logs 
FOR UPDATE 
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete their workspace call logs" 
ON public.call_logs 
FOR DELETE 
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups by lead
CREATE INDEX idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_workspace_id ON public.call_logs(workspace_id);