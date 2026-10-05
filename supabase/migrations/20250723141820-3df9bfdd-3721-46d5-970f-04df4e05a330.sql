
-- Adicionar campo status na tabela calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN status TEXT DEFAULT 'pending';

-- Adicionar campo source para identificar origem dos eventos
ALTER TABLE public.calendar_events 
ADD COLUMN source TEXT DEFAULT 'local';
