-- Add customization columns to public_booking_links
ALTER TABLE public.public_booking_links 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3600FF',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#F9FAFB',
ADD COLUMN IF NOT EXISTS custom_message TEXT;

-- Enable RLS
ALTER TABLE public.public_booking_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to recreate them properly
DROP POLICY IF EXISTS "public_booking_links_public_read" ON public.public_booking_links;
DROP POLICY IF EXISTS "public_booking_links_owner_crud" ON public.public_booking_links;

-- Create policy for public read (anyone can read active links)
CREATE POLICY "public_booking_links_public_read" 
ON public.public_booking_links 
FOR SELECT 
USING (is_active = true);

-- Create policy for owners to manage their links
CREATE POLICY "public_booking_links_owner_crud" 
ON public.public_booking_links 
FOR ALL 
USING (auth.uid() = user_id);

-- Also ensure availability_schedules can be read publicly for booking links
DROP POLICY IF EXISTS "availability_schedules_public_read" ON public.availability_schedules;
CREATE POLICY "availability_schedules_public_read"
ON public.availability_schedules
FOR SELECT
USING (is_active = true);

-- Ensure public_bookings allows inserts from public (for booking submission)
DROP POLICY IF EXISTS "public_bookings_public_insert" ON public.public_bookings;
CREATE POLICY "public_bookings_public_insert"
ON public.public_bookings
FOR INSERT
WITH CHECK (true);