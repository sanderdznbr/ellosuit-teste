CREATE TABLE IF NOT EXISTS public.user_card_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_card_labels TO authenticated;
GRANT ALL ON public.user_card_labels TO service_role;

ALTER TABLE public.user_card_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own labels"
ON public.user_card_labels
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_card_labels_updated_at
BEFORE UPDATE ON public.user_card_labels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();