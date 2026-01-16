-- إضافة ربط المدير العام بالموظفين الآخرين
INSERT INTO employee_supervisors (supervisor_id, employee_id, is_active)
VALUES 
  -- المدير العام → سارة أحمد
  ('91484496-b887-44f7-9e5d-be9db5567604', 'f10d8ed9-24d3-45d6-a310-d45db5a747a0', true),
  -- المدير العام → عبدالله
  ('91484496-b887-44f7-9e5d-be9db5567604', 'd46021fe-8cde-4575-97ac-c2661ee91527', true),
  -- المدير العام → أحمد
  ('91484496-b887-44f7-9e5d-be9db5567604', 'fba59dfc-451c-4906-8882-ae4601ff34d4', true),
  -- المدير العام → محمد
  ('91484496-b887-44f7-9e5d-be9db5567604', '8410cfca-6d38-4376-8b93-d27d13cb38e2', true)
ON CONFLICT DO NOTHING;