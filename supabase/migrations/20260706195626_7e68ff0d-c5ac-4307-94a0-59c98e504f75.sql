
UPDATE public.email_templates
SET
  html_content = REPLACE(REPLACE(COALESCE(html_content,''),'https://ellosuit-connect-vista.lovable.app','https://www.ellosuit.app'),'https://www.ellosuit.online','https://www.ellosuit.app'),
  design_data = CASE
    WHEN design_data IS NULL THEN NULL
    ELSE REPLACE(REPLACE(design_data::text,'https://ellosuit-connect-vista.lovable.app','https://www.ellosuit.app'),'https://www.ellosuit.online','https://www.ellosuit.app')::jsonb
  END
WHERE
  COALESCE(html_content,'') LIKE '%ellosuit.online%' OR COALESCE(html_content,'') LIKE '%ellosuit-connect-vista.lovable.app%'
  OR (design_data IS NOT NULL AND (design_data::text LIKE '%ellosuit.online%' OR design_data::text LIKE '%ellosuit-connect-vista.lovable.app%'));

UPDATE public.email_designs
SET design_data = REPLACE(REPLACE(design_data::text,'https://ellosuit-connect-vista.lovable.app','https://www.ellosuit.app'),'https://www.ellosuit.online','https://www.ellosuit.app')::jsonb
WHERE design_data IS NOT NULL
  AND (design_data::text LIKE '%ellosuit.online%' OR design_data::text LIKE '%ellosuit-connect-vista.lovable.app%');

UPDATE public.calendar_events
SET
  meeting_link = CASE WHEN meeting_link IS NULL THEN NULL ELSE REPLACE(REPLACE(meeting_link,'https://ellosuit-connect-vista.lovable.app','https://www.ellosuit.app'),'https://www.ellosuit.online','https://www.ellosuit.app') END,
  description = REPLACE(REPLACE(COALESCE(description,''),'https://ellosuit-connect-vista.lovable.app','https://www.ellosuit.app'),'https://www.ellosuit.online','https://www.ellosuit.app')
WHERE (meeting_link IS NOT NULL AND (meeting_link LIKE '%ellosuit.online%' OR meeting_link LIKE '%ellosuit-connect-vista.lovable.app%'))
   OR COALESCE(description,'') LIKE '%ellosuit.online%' OR COALESCE(description,'') LIKE '%ellosuit-connect-vista.lovable.app%';
