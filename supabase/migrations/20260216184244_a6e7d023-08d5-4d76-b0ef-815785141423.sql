-- Add archived_at column to notifications for auto-archive feature
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient querying of non-archived notifications
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON public.notifications (user_id, archived_at) WHERE archived_at IS NULL;

-- Delete duplicate event notifications, keeping only the oldest one per event+type+minutes
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.metadata->>'event_id' = b.metadata->>'event_id'
  AND a.metadata->>'notification_type' = b.metadata->>'notification_type'
  AND a.metadata->>'minutes_until' = b.metadata->>'minutes_until'
  AND a.metadata->>'notification_type' IN ('event_upcoming', 'task_due');

-- Now create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_dedup 
ON public.notifications (
  user_id, 
  (metadata->>'event_id'), 
  (metadata->>'notification_type'), 
  (metadata->>'minutes_until')
) 
WHERE metadata->>'event_id' IS NOT NULL AND metadata->>'notification_type' IN ('event_upcoming', 'task_due');
