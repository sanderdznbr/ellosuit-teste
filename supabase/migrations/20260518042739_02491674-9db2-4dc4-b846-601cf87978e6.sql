
-- 1. Fix is_participant_in_room null bypass
CREATE OR REPLACE FUNCTION public.is_participant_in_room(_room_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_participants
    WHERE room_id = _room_id
      AND user_id = _user_id
      AND left_at IS NULL
  );
$function$;

-- 2. ai_agent_conversions: company-scoped via ai_agents
DROP POLICY IF EXISTS "Authenticated users can manage ai_agent_conversions" ON public.ai_agent_conversions;
DROP POLICY IF EXISTS "Users can manage ai_agent_conversions" ON public.ai_agent_conversions;
DROP POLICY IF EXISTS "ai_agent_conversions_all" ON public.ai_agent_conversions;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.ai_agent_conversions;

CREATE POLICY "Company members can manage ai_agent_conversions"
ON public.ai_agent_conversions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_agents a
    WHERE a.id = ai_agent_conversions.agent_id
      AND public.user_belongs_to_company(a.company_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_agents a
    WHERE a.id = ai_agent_conversions.agent_id
      AND public.user_belongs_to_company(a.company_id, auth.uid())
  )
);

-- 3. ai_agent_extracted_data: company-scoped via ai_agents
DROP POLICY IF EXISTS "Authenticated users can manage ai_agent_extracted_data" ON public.ai_agent_extracted_data;
DROP POLICY IF EXISTS "Users can manage ai_agent_extracted_data" ON public.ai_agent_extracted_data;
DROP POLICY IF EXISTS "ai_agent_extracted_data_all" ON public.ai_agent_extracted_data;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.ai_agent_extracted_data;

CREATE POLICY "Company members can manage ai_agent_extracted_data"
ON public.ai_agent_extracted_data
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_agents a
    WHERE a.id = ai_agent_extracted_data.agent_id
      AND public.user_belongs_to_company(a.company_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_agents a
    WHERE a.id = ai_agent_extracted_data.agent_id
      AND public.user_belongs_to_company(a.company_id, auth.uid())
  )
);

-- 4. Storage 'tutorials' bucket: enforce adminmaster on write operations
DROP POLICY IF EXISTS "Adminmaster can upload tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Adminmaster can update tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Adminmaster can delete tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Adminmaster can manage tutorials" ON storage.objects;

CREATE POLICY "Adminmaster can upload tutorials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tutorials' AND public.is_adminmaster(auth.uid()));

CREATE POLICY "Adminmaster can update tutorials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tutorials' AND public.is_adminmaster(auth.uid()))
WITH CHECK (bucket_id = 'tutorials' AND public.is_adminmaster(auth.uid()));

CREATE POLICY "Adminmaster can delete tutorials"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'tutorials' AND public.is_adminmaster(auth.uid()));

-- 5. Storage 'brand-assets' bucket: require auth on INSERT, path-ownership on DELETE
DROP POLICY IF EXISTS "Anyone can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their brand assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload brand assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own brand assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
