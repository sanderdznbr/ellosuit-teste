-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  file_url TEXT,
  folder_id UUID,
  tags TEXT[],
  description TEXT,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_folders table
CREATE TABLE public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_folder_id UUID,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company_name TEXT,
  cnpj_cpf TEXT,
  address_street TEXT,
  address_number TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_interactions table
CREATE TABLE public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  interaction_type TEXT NOT NULL,
  description TEXT,
  interaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view company documents" ON public.documents
FOR SELECT USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create documents in their company" ON public.documents
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update their documents" ON public.documents
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their documents" ON public.documents
FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for document_folders
CREATE POLICY "Users can view company folders" ON public.document_folders
FOR SELECT USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create folders in their company" ON public.document_folders
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update their folders" ON public.document_folders
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their folders" ON public.document_folders
FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for clients
CREATE POLICY "Users can view company clients" ON public.clients
FOR SELECT USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create clients in their company" ON public.clients
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update clients" ON public.clients
FOR UPDATE USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete clients" ON public.clients
FOR DELETE USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

-- RLS Policies for client_interactions
CREATE POLICY "Users can view company client interactions" ON public.client_interactions
FOR SELECT USING (company_id IN (
  SELECT company_id FROM company_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create client interactions" ON public.client_interactions
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

-- Add foreign key constraints
ALTER TABLE public.documents ADD CONSTRAINT fk_documents_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.documents ADD CONSTRAINT fk_documents_folder 
FOREIGN KEY (folder_id) REFERENCES public.document_folders(id);

ALTER TABLE public.document_folders ADD CONSTRAINT fk_folders_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.document_folders ADD CONSTRAINT fk_folders_parent 
FOREIGN KEY (parent_folder_id) REFERENCES public.document_folders(id);

ALTER TABLE public.clients ADD CONSTRAINT fk_clients_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.client_interactions ADD CONSTRAINT fk_interactions_client 
FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE public.client_interactions ADD CONSTRAINT fk_interactions_company 
FOREIGN KEY (company_id) REFERENCES public.companies(id);

-- Add triggers for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_folders_updated_at
BEFORE UPDATE ON public.document_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();