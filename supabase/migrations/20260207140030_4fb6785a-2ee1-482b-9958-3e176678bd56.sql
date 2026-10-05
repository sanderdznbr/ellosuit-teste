-- Create bucket for WhatsApp media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Policy for authenticated upload (edge functions use service role)
CREATE POLICY "Authenticated users can upload to whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- Policy for authenticated delete
CREATE POLICY "Authenticated users can delete from whatsapp-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');