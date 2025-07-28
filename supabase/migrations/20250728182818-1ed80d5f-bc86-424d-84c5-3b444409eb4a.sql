-- تصحيح الحركات النقدية للطلبات المستلمة
-- حذف الحركات النقدية الخاطئة للطلبات
DELETE FROM cash_movements 
WHERE reference_type = 'order_payment' 
AND reference_id IN (
  'd134d21c-f8b6-4b35-b2a3-d420819ac31f', -- ORD000001
  '00798655-f91d-45d4-b1b5-e1dfc1a47266', -- ORD000002  
  'a56f0048-20cc-48e3-a9f3-878d1d2f7aab'  -- ORD000004
);

-- إضافة الحركات النقدية الصحيحة بالمبلغ الفعلي (بدون رسوم التوصيل)
-- الطلب 1: 45,000 د.ع
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  reference_id,
  description,
  balance_before,
  balance_after,
  created_by,
  created_at
) VALUES (
  (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  45000.00,
  'in',
  'order_revenue',
  'd134d21c-f8b6-4b35-b2a3-d420819ac31f',
  'إيراد طلب رقم ORD000001 (بدون رسوم التوصيل)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 45000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-07-21 00:06:27.958507+00'
);

-- الطلب 2: 45,000 د.ع  
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  reference_id,
  description,
  balance_before,
  balance_after,
  created_by,
  created_at
) VALUES (
  (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  45000.00,
  'in',
  'order_revenue',
  '00798655-f91d-45d4-b1b5-e1dfc1a47266',
  'إيراد طلب رقم ORD000002 (بدون رسوم التوصيل)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 45000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-07-16 00:17:04.699+00'
);

-- الطلب 4: 16,000 د.ع
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  reference_id,
  description,
  balance_before,
  balance_after,
  created_by,
  created_at
) VALUES (
  (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  16000.00,
  'in',
  'order_revenue',
  'a56f0048-20cc-48e3-a9f3-878d1d2f7aab',
  'إيراد طلب رقم ORD000004 (بدون رسوم التوصيل)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 16000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  'fba59dfc-451c-4906-8882-ae4601ff34d4',
  '2025-07-28 00:45:14.326+00'
);

-- تصحيح رصيد القاصة الرئيسية
UPDATE cash_sources 
SET current_balance = (
  5000000 + -- رأس المال
  106000 - -- الإيرادات الفعلية  
  15000 - -- المصاريف العامة
  7000    -- مستحقات الموظفين المدفوعة
)
WHERE name = 'القاصة الرئيسية';