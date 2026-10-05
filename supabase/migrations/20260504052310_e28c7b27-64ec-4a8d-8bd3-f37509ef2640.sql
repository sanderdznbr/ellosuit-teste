-- Tabela para indexar os áudios gerados
CREATE TABLE IF NOT EXISTS public.tts_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_hash TEXT NOT NULL,
    original_text TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash_voice ON public.tts_cache(text_hash, voice_id);

-- Habilitar RLS
ALTER TABLE public.tts_cache ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Qualquer usuário autenticado pode ler o cache de TTS"
ON public.tts_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Qualquer usuário autenticado pode inserir no cache de TTS"
ON public.tts_cache FOR INSERT
TO authenticated
WITH CHECK (true);

-- Criar bucket de storage se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-cache', 'tts-cache', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket tts-cache
CREATE POLICY "Acesso público aos áudios de TTS"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tts-cache');

CREATE POLICY "Usuários autenticados podem enviar áudios de TTS"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tts-cache');