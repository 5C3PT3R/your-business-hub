-- Add media_id column to social_messages for storing WhatsApp media IDs
-- This allows re-fetching media URLs if they expire

ALTER TABLE public.social_messages
ADD COLUMN IF NOT EXISTS media_id TEXT;

-- Add index for media_id lookups (useful for re-fetching)
CREATE INDEX IF NOT EXISTS idx_social_messages_media_id
ON social_messages(media_id)
WHERE media_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.social_messages.media_id IS
'Platform-specific media ID (e.g., WhatsApp media ID). Used to re-fetch media URLs if needed.';
