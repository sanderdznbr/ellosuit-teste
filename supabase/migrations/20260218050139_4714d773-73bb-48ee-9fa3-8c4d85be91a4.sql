-- Add 'free' to the plan_type enum
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'free' BEFORE 'base';