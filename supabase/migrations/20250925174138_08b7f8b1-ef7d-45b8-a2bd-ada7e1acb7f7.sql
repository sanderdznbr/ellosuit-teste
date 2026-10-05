-- Create 'documents' storage bucket if it doesn't exist and add policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('documents', 'documents', true);
  END IF;
END $$;

-- Policies for the 'documents' bucket
-- Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read documents'
  ) THEN
    CREATE POLICY "Public read documents"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'documents');
  END IF;
END $$;

-- Allow authenticated users to upload files to 'documents'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload to documents'
  ) THEN
    CREATE POLICY "Authenticated upload to documents"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Allow authenticated users to update (e.g., replace) their files in 'documents'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated update documents'
  ) THEN
    CREATE POLICY "Authenticated update documents"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'documents' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Allow authenticated users to delete files in 'documents'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated delete documents'
  ) THEN
    CREATE POLICY "Authenticated delete documents"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
  END IF;
END $$;