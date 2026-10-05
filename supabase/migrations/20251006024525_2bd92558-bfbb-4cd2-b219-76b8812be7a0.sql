-- Adicionar políticas RLS para permitir exclusão de gravações de reuniões
CREATE POLICY "Users can delete their meeting recordings"
ON public.meeting_recordings
FOR DELETE
USING (created_by = auth.uid());

-- Adicionar políticas RLS para permitir exclusão de arquivos no storage bucket meeting-recordings
CREATE POLICY "Users can delete their own recording files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meeting-recordings' 
  AND auth.uid() IS NOT NULL
);