
-- Criar bucket para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Política para permitir que qualquer usuário autenticado faça upload
CREATE POLICY "Authenticated users can upload logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'logos' AND 
  auth.role() = 'authenticated'
);

-- Política para permitir que qualquer usuário autenticado veja as logos
CREATE POLICY "Anyone can view logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

-- Política para permitir que usuários deletem suas próprias logos
CREATE POLICY "Users can delete their own logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'logos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
