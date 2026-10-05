-- Add booking links and schedules tables for AGENDA ABERTA feature
-- Create booking links table
CREATE TABLE IF NOT EXISTS public.booking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  link_slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create availability schedules table
CREATE TABLE IF NOT EXISTS public.user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table for scheduled appointments
CREATE TABLE IF NOT EXISTS public.scheduled_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_link_id UUID NOT NULL REFERENCES public.booking_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for booking_links
CREATE POLICY "Users can manage their own booking links" ON public.booking_links
  USING (user_id = auth.uid());

CREATE POLICY "Allow public read access to active booking links" ON public.booking_links
  FOR SELECT USING (is_active = true);

-- RLS policies for user_availability
CREATE POLICY "Users can manage their own availability" ON public.user_availability
  USING (user_id = auth.uid());

CREATE POLICY "Allow public read access to active availability" ON public.user_availability
  FOR SELECT USING (is_active = true);

-- RLS policies for scheduled_bookings
CREATE POLICY "Users can view their own bookings" ON public.scheduled_bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can create bookings" ON public.scheduled_bookings
  FOR INSERT WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_booking_links_updated_at
  BEFORE UPDATE ON public.booking_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_availability_updated_at
  BEFORE UPDATE ON public.user_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_bookings_updated_at
  BEFORE UPDATE ON public.scheduled_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();