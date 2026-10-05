
-- Link user to company
INSERT INTO public.company_users (company_id, user_id, role)
VALUES ('f4c902ec-fc62-4bf8-9176-20873469e0bf', 'ab39528f-727d-418e-be5a-ea80900cf3a5', 'admin')
ON CONFLICT DO NOTHING;

-- Update subscription to Business unlimited
UPDATE public.subscriptions 
SET plan_type = 'business', status = 'active', monthly_price = 0, base_users_included = 999, current_period_end = '2099-12-31T23:59:59Z'
WHERE company_id = 'f4c902ec-fc62-4bf8-9176-20873469e0bf';

-- Modules
DELETE FROM public.subscription_modules WHERE company_id = 'f4c902ec-fc62-4bf8-9176-20873469e0bf';
INSERT INTO public.subscription_modules (subscription_id, company_id, module_type, is_active, monthly_price) VALUES
  ('647eb354-299a-46cc-806c-0b5684c689a3', 'f4c902ec-fc62-4bf8-9176-20873469e0bf', 'omni', true, 0),
  ('647eb354-299a-46cc-806c-0b5684c689a3', 'f4c902ec-fc62-4bf8-9176-20873469e0bf', 'flow', true, 0),
  ('647eb354-299a-46cc-806c-0b5684c689a3', 'f4c902ec-fc62-4bf8-9176-20873469e0bf', 'track', true, 0);

-- Limits unlimited
DELETE FROM public.subscription_limits WHERE company_id = 'f4c902ec-fc62-4bf8-9176-20873469e0bf';
INSERT INTO public.subscription_limits (company_id, max_users, max_storage_gb, max_emails_month, max_ai_agents, max_whatsapp_sessions, max_booking_links, max_meeting_hours, max_tracked_docs, max_tracked_links, max_tracked_videos, max_chatbot_flows, max_meeting_participants, has_meeting_recording, has_priority_support)
VALUES ('f4c902ec-fc62-4bf8-9176-20873469e0bf', 9999, 9999, 999999, 9999, 9999, 9999, 99999, 9999, 9999, 9999, 9999, 100, true, true);
