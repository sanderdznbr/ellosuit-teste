-- Ensure proper storage policies for trackable documents bucket

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Allow public read access to trackable documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload trackable documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own trackable documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own trackable documents" ON storage.objects;

-- Create storage policies for trackable documents
CREATE POLICY "Allow public read access to trackable documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trackable-documents');

CREATE POLICY "Allow authenticated users to upload trackable documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trackable-documents');

CREATE POLICY "Allow users to update their own trackable documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'trackable-documents');

CREATE POLICY "Allow users to delete their own trackable documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trackable-documents');