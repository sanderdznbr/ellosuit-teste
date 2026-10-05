-- Activate all modules for the admin with the subscription_id
INSERT INTO public.subscription_modules (subscription_id, company_id, module_type, is_active, monthly_price, activated_at)
VALUES 
  ('24edf1a2-926c-4aab-8e7c-24e121c7db3e', '92c0552b-2985-4ff7-8cf5-78298f564a72', 'omni', true, 0, now()),
  ('24edf1a2-926c-4aab-8e7c-24e121c7db3e', '92c0552b-2985-4ff7-8cf5-78298f564a72', 'flow', true, 0, now()),
  ('24edf1a2-926c-4aab-8e7c-24e121c7db3e', '92c0552b-2985-4ff7-8cf5-78298f564a72', 'track', true, 0, now())
ON CONFLICT (company_id, module_type) DO UPDATE SET is_active = true, monthly_price = 0;

-- Set unlimited limits for admin
UPDATE public.subscription_limits
SET 
  max_users = 999999,
  max_storage_gb = 999999,
  max_emails_month = 999999,
  max_ai_agents = 999999,
  max_whatsapp_sessions = 999999,
  max_booking_links = 999999,
  max_meeting_hours = 999999,
  max_tracked_docs = 999999,
  max_tracked_links = 999999,
  max_tracked_videos = 999999,
  max_meeting_participants = 999999,
  max_chatbot_flows = 999999,
  has_priority_support = true,
  updated_at = now()
WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72';