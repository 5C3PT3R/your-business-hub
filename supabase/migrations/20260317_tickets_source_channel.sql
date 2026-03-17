-- Add discord, telegram, web to tickets source_channel check constraint
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_source_channel_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_source_channel_check
  CHECK (source_channel IN ('whatsapp', 'email', 'instagram', 'discord', 'telegram', 'web'));
