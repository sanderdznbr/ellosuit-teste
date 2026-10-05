
-- Add missing theme columns to public_booking_links
ALTER TABLE public.public_booking_links
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS border_radius text DEFAULT '16',
  ADD COLUMN IF NOT EXISTS button_style text DEFAULT 'filled',
  ADD COLUMN IF NOT EXISTS success_title text DEFAULT 'Agendamento Confirmado!',
  ADD COLUMN IF NOT EXISTS success_message text DEFAULT 'Enviamos os detalhes para o seu email.',
  ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'Confirmar Agendamento',
  ADD COLUMN IF NOT EXISTS show_duration boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_description boolean DEFAULT true;
