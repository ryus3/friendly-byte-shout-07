-- إصلاح بيانات الطلب ORD000005 ليصبح مثل ORD000004

-- 1. إصلاح الإيراد في جدول الأرباح
UPDATE public.profits 
SET total_revenue = 21000,
    updated_at = now()
WHERE order_id IN (
  SELECT id FROM public.orders 
  WHERE order_number = 'ORD000005'
);

-- 2. إنشاء حركة نقدية للإيراد الصحيح
INSERT INTO public.cash_movements (
  cash_source_id,
  amount,
  reference_id,
  balance_before,
  balance_after,
  created_by,
  movement_type,
  reference_type,
  description
) 
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  21000,
  o.id,
  5141000,
  5162000,
  o.created_by,
  'revenue',
  'order',
  'إيراد طلب ORD000005: المستلم 21,000 (الإجمالي 26,000 - التوصيل 5,000)'
FROM public.orders o
WHERE o.order_number = 'ORD000005';

-- 3. إنشاء مصروف مستحقات الموظف
INSERT INTO public.expenses (
  amount,
  created_by,
  approved_by,
  approved_at,
  expense_type,
  category,
  description,
  status,
  metadata
)
SELECT 
  7000,
  o.created_by,
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  now(),
  'system',
  'مستحقات الموظفين',
  'مستحقات الموظف احمد - طلب ORD000005',
  'approved',
  jsonb_build_object(
    'order_id', o.id,
    'order_number', 'ORD000005',
    'employee_name', 'احمد',
    'transaction_date', o.created_at::date
  )
FROM public.orders o
WHERE o.order_number = 'ORD000005';

-- 4. إنشاء حركة نقدية لمستحقات الموظف
INSERT INTO public.cash_movements (
  cash_source_id,
  amount,
  reference_id,
  balance_before,
  balance_after,
  created_by,
  movement_type,
  reference_type,
  description
)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  -7000,
  o.id,
  5162000,
  5155000,
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  'employee_dues',
  'order',
  'دفع مستحقات الموظف احمد - طلب ORD000005'
FROM public.orders o
WHERE o.order_number = 'ORD000005';

-- 5. حذف الحركات النقدية المكررة لأجور التوصيل (إن وجدت)
DELETE FROM public.cash_movements 
WHERE description LIKE '%ORD000005%' 
  AND movement_type = 'delivery_expense'
  AND reference_type = 'order';