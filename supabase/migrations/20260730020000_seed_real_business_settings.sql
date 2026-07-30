-- Overwrite the placeholder business/commerce settings seeded in the previous
-- migration with the studio's real contact and social details.
INSERT INTO public.settings (key, value)
VALUES
  (
    'business',
    '{"business_name":"Deepcuts Hair Studio","email":"saviourchinyantac2@gmail.com","phone":"+260979011711","whatsapp":"+260979011711","address":"Chelstone Small Market, Lusaka, Zambia","hours":"Tue-Sat 9am-8pm · Sun 10am-4pm · Closed Mon","instagram":"https://instagram.com/DEEPCUTZM","facebook":"https://facebook.com/DEEPCUTSZM","twitter":"https://twitter.com","tiktok":"https://tiktok.com/@deepcutsbarbershop1","youtube":"https://youtube.com/@deepcutszm"}'::jsonb
  ),
  (
    'commerce',
    '{"currency":"ZMW","delivery_fee":15,"pickup_address":"Chelstone Small Market, Lusaka, Zambia","low_stock_threshold":5}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
