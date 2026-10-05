
-- Create storage bucket for disparo media files
INSERT INTO storage.buckets (id, name, public) VALUES ('disparos-media', 'disparos-media', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload disparo media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'disparos-media' AND auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Public read access for disparo media"
ON storage.objects FOR SELECT
USING (bucket_id = 'disparos-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete disparo media"
ON storage.objects FOR DELETE
USING (bucket_id = 'disparos-media' AND auth.role() = 'authenticated');
