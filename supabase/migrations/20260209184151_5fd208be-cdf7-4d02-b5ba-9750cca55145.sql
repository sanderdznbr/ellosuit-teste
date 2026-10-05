
-- 1. Add 'adminmaster' to company_role enum
ALTER TYPE public.company_role ADD VALUE IF NOT EXISTS 'adminmaster';
