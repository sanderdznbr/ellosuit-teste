
-- Criar tabela para horários de disponibilidade
CREATE TABLE public.availability_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Domingo, 6 = Sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para links públicos de agendamento
CREATE TABLE public.public_booking_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  link_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para agendamentos públicos
CREATE TABLE public.public_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_link_id UUID NOT NULL REFERENCES public.public_booking_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para feriados
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar RLS nas tabelas
ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para availability_schedules
CREATE POLICY "Users can manage their own availability schedules"
  ON public.availability_schedules
  FOR ALL
  USING (user_id = auth.uid());

-- Políticas RLS para public_booking_links
CREATE POLICY "Users can manage their own booking links"
  ON public.public_booking_links
  FOR ALL
  USING (user_id = auth.uid());

-- Políticas RLS para public_bookings
CREATE POLICY "Users can view their own bookings"
  ON public.public_bookings
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can create bookings"
  ON public.public_bookings
  FOR INSERT
  WITH CHECK (true);

-- Políticas RLS para holidays
CREATE POLICY "Users can manage their own holidays"
  ON public.holidays
  FOR ALL
  USING (user_id = auth.uid());

-- Adicionar triggers para updated_at
CREATE TRIGGER update_availability_schedules_updated_at
  BEFORE UPDATE ON public.availability_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_public_booking_links_updated_at
  BEFORE UPDATE ON public.public_booking_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_public_bookings_updated_at
  BEFORE UPDATE ON public.public_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
