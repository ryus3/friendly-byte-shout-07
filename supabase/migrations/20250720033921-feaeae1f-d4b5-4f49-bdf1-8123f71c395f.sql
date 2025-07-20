-- إضافة مصروف تجريبي لاختبار النظام
DO $$
DECLARE
  current_user_id UUID;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- إضافة مصروف تجريبي
  INSERT INTO public.expenses (
    category,
    expense_type,
    description,
    amount,
    vendor_name,
    receipt_number,
    status,
    created_by
  ) VALUES (
    'مصاريف إدارية',
    'operational',
    'مصروف تجريبي لاختبار النظام',
    5000,
    'مورد تجريبي',
    'TEST-001',
    'approved',
    current_user_id
  );
  
  RAISE NOTICE 'تم إضافة مصروف تجريبي';
END $$;