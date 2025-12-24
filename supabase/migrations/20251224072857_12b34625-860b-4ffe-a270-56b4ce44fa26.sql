-- Add related_lead_id column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN related_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_related_lead_id ON public.tasks(related_lead_id);