UPDATE ai_agents 
SET settings = settings || '{"is_platform_agent": true}'::jsonb
WHERE name ILIKE '%Ellosuit%' OR settings->>'is_platform_agent' IS NULL;