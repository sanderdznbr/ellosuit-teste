UPDATE email_templates 
SET 
  html_content = REPLACE(html_content, 'https://ellosuit-connect-vista.lovable.app', 'https://www.ellosuit.online'),
  design_data = REPLACE(design_data::text, 'https://ellosuit-connect-vista.lovable.app', 'https://www.ellosuit.online')::jsonb
WHERE design_data::text LIKE '%ellosuit-connect-vista.lovable.app%' 
   OR html_content LIKE '%ellosuit-connect-vista.lovable.app%';