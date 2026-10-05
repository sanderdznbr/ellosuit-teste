INSERT INTO public.notification_preferences (user_id, company_id, whatsapp_number, whatsapp_enabled)
SELECT cu.user_id, cu.company_id, au.raw_user_meta_data->>'phone', true
FROM public.company_users cu
JOIN auth.users au ON au.id = cu.user_id
WHERE au.raw_user_meta_data->>'phone' IS NOT NULL
  AND au.raw_user_meta_data->>'phone' != ''
  AND NOT EXISTS (SELECT 1 FROM public.notification_preferences np WHERE np.user_id = cu.user_id)
ON CONFLICT DO NOTHING;