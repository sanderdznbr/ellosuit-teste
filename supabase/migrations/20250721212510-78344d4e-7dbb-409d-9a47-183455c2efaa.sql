
-- Adicionar coluna color na tabela calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN color text DEFAULT '#3600FF';

-- Comentário: Adicionando campo para cores personalizadas dos eventos
-- Valor padrão é a cor azul atual do sistema
