-- Adicionar coluna para mapear nomes dos speakers nas reuniões presenciais
ALTER TABLE public.in_person_meetings 
ADD COLUMN speaker_mapping jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.in_person_meetings.speaker_mapping IS 'Mapeamento de speakers genéricos para nomes reais, ex: {"Pessoa 1": "João Silva", "Pessoa 2": "Maria Santos"}';

-- Adicionar coluna para armazenar timestamps relativos nas transcrições
ALTER TABLE public.in_person_meetings 
ADD COLUMN transcript_with_timestamps jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.in_person_meetings.transcript_with_timestamps IS 'Array de objetos com {timestamp_seconds: number, speaker: string, text: string}';

-- Adicionar mesmas colunas para meeting_recordings
ALTER TABLE public.meeting_recordings 
ADD COLUMN speaker_mapping jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.meeting_recordings 
ADD COLUMN transcript_with_timestamps jsonb DEFAULT '[]'::jsonb;