-- Allow public access to trackable documents via public_link_id
CREATE POLICY "Allow public access to trackable documents via link"
ON public.trackable_documents
FOR SELECT
TO public
USING (tracking_enabled = true AND public_link_id IS NOT NULL);