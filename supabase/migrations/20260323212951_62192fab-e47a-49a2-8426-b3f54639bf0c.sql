-- Delete duplicate ycloud_sessions keeping only the newest per company_id + phone_number
DELETE FROM ycloud_sessions a
USING ycloud_sessions b
WHERE a.company_id = b.company_id
  AND a.phone_number = b.phone_number
  AND a.created_at < b.created_at;

-- Add unique constraint to prevent future duplicates
ALTER TABLE ycloud_sessions ADD CONSTRAINT ycloud_sessions_company_phone_unique UNIQUE (company_id, phone_number);