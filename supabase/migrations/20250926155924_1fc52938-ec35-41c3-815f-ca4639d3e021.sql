-- Fix RLS policies for trackable_documents - drop all existing policies first

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload trackable documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to trackable documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their trackable documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their trackable documents storage" ON storage.objects;

-- Create storage policies for trackable-documents bucket
CREATE POLICY "Allow uploads to trackable documents bucket" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'trackable-documents');

CREATE POLICY "Allow public read access to trackable documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'trackable-documents');