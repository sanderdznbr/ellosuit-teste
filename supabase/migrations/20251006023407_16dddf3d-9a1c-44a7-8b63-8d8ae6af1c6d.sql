-- Adicionar política para permitir uploads de reuniões presenciais
CREATE POLICY "Users can upload in-person meeting recordings"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meeting-recordings' 
  AND auth.uid() IS NOT NULL
);