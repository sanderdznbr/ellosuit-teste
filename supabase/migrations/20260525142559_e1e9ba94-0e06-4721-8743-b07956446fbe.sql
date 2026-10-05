-- Criar função para gerar public_link_id se não fornecido
CREATE OR REPLACE FUNCTION public.handle_trackable_document_public_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_link_id IS NULL THEN
        NEW.public_link_id := encode(gen_random_bytes(12), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para preenchimento automático
DROP TRIGGER IF EXISTS tr_trackable_document_public_id ON public.trackable_documents;
CREATE TRIGGER tr_trackable_document_public_id
BEFORE INSERT ON public.trackable_documents
FOR EACH ROW
EXECUTE FUNCTION public.handle_trackable_document_public_id();

-- Garantir políticas de storage para documentos
-- Nota: O bucket 'documents' deve existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload para sua pasta de empresa
CREATE POLICY "Users can upload tracked documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] = 'tracked'
);

-- Política para permitir que qualquer pessoa veja os documentos rastreados (necessário para o viewer público)
CREATE POLICY "Public can view tracked documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');
