-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to avatars
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Create covers bucket for profile cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own cover
CREATE POLICY "Users can upload own cover"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own cover
CREATE POLICY "Users can update own cover"
ON storage.objects FOR UPDATE
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to covers
CREATE POLICY "Covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');