-- تصحيح الحركات النقدية للطلبات المستلمة (المبلغ الفعلي بعد خصم رسوم التوصيل)
-- حذف الحركات النقدية الخاطئة للطلبات
DELETE FROM cash_movements 
WHERE reference_type IN ('order_payment', 'order_revenue')
AND reference_id IN (
  'd134d21c-f8b6-4b35-b2a3-d420819ac31f', -- ORD000001
  '00798655-f91d-45d4-b1b5-e1dfc1a47266', -- ORD000002  
  'a56f0048-20cc-48e3-a9f3-878d1d2f7aab'  -- ORD000004
);

-- إضافة الحركات النقدية الصحيحة بالمبلغ الفعلي المستلم (إجمالي - رسوم التوصيل)
-- الطلب 1: 55 - 5 = 50,000 د.ع
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
  50000.00,
  'in',
  'order_revenue',
  'd134d21c-f8b6-4b35-b2a3-d420819ac31f',
  'إيراد طلب رقم ORD000001 (50,000 بعد خصم رسوم التوصيل 5,000)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 50000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-07-21 00:06:27.958507+00'
);

-- الطلب 2: 55 - 5 = 50,000 د.ع  
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
  50000.00,
  'in',
  'order_revenue',
  '00798655-f91d-45d4-b1b5-e1dfc1a47266',
  'إيراد طلب رقم ORD000002 (50,000 بعد خصم رسوم التوصيل 5,000)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 50000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-07-16 00:17:04.699+00'
);

-- الطلب 4: 26 - 5 = 21,000 د.ع
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
  21000.00,
  'in',
  'order_revenue',
  'a56f0048-20cc-48e3-a9f3-878d1d2f7aab',
  'إيراد طلب رقم ORD000004 (21,000 بعد خصم رسوم التوصيل 5,000)',
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية') - 21000,
  (SELECT current_balance FROM cash_sources WHERE name = 'القاصة الرئيسية'),
  'fba59dfc-451c-4906-8882-ae4601ff34d4',
  '2025-07-28 00:45:14.326+00'
);

-- تصحيح رصيد القاصة الرئيسية
-- إجمالي الإيرادات الفعلية: 50 + 50 + 21 = 121,000
UPDATE cash_sources 
SET current_balance = (
  5000000 + -- رأس المال
  121000 - -- الإيرادات الفعلية (بعد خصم رسوم التوصيل)
  15000 - -- المصاريف العامة
  7000    -- مستحقات الموظفين المدفوعة
)
WHERE name = 'القاصة الرئيسية';