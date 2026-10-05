
-- Create receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_by UUID NOT NULL,
  receipt_number TEXT,
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT,
  client_document TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  sent_at TIMESTAMPTZ,
  custom_colors JSONB,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts from their company"
ON public.receipts FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create receipts"
ON public.receipts FOR INSERT
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update receipts"
ON public.receipts FOR UPDATE
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete receipts"
ON public.receipts FOR DELETE
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_receipts_updated_at
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-generate receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.receipts
  WHERE company_id = NEW.company_id;
  
  NEW.receipt_number := 'REC-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_receipt_number_trigger
BEFORE INSERT ON public.receipts
FOR EACH ROW
WHEN (NEW.receipt_number IS NULL)
EXECUTE FUNCTION public.generate_receipt_number();
