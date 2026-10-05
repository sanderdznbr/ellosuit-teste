ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS batch_size integer,
  ADD COLUMN IF NOT EXISTS batch_limit integer,
  ADD COLUMN IF NOT EXISTS auto_next_batch boolean NOT NULL DEFAULT false;