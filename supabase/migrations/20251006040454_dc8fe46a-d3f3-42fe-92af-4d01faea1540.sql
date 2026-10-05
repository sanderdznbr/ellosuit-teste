-- Tornar o bucket meeting-recordings público para permitir acesso do AssemblyAI
UPDATE storage.buckets 
SET public = true 
WHERE id = 'meeting-recordings';

-- Criar política de acesso público para leitura
CREATE POLICY "Public read access to meeting recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'meeting-recordings');

-- Manter políticas de escrita restritas aos usuários autenticados da empresa
CREATE POLICY "Users can upload meeting recordings"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meeting-recordings' 
  AND auth.uid() IS NOT NULL
);