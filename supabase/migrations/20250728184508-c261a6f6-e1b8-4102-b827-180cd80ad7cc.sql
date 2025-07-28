-- إصلاح شامل للنظام المالي

-- 1. تصحيح بيانات الطلبات (إجمالي المبلغ يجب أن يكون كاملاً مع التوصيل)
UPDATE orders 
SET total_amount = 55000.00 
WHERE id = 'd134d21c-f8b6-4b35-b2a3-d420819ac31f' AND order_number = 'ORD000001';

UPDATE orders 
SET total_amount = 55000.00 
WHERE id = '00798655-f91d-45d4-b1b5-e1dfc1a47266' AND order_number = 'ORD000002';

UPDATE orders 
SET total_amount = 26000.00 
WHERE id = 'a56f0048-20cc-48e3-a9f3-878d1d2f7aab' AND order_number = 'ORD000004';

-- 2. حذف المصاريف الخاطئة (رسوم التوصيل لا يجب أن تكون مصاريف لأنها مخصومة من الإيراد مسبقاً)
DELETE FROM expenses 
WHERE category = 'التوصيل والشحن' 
AND receipt_number IN ('ORD000001-DELIVERY', 'ORD000002-DELIVERY', 'ORD000004-DELIVERY');

-- 3. حذف الحركات النقدية الخاطئة
DELETE FROM cash_movements 
WHERE reference_type IN ('delivery_fees', 'order_revenue', 'adjustment') 
AND reference_id IN (
  'd134d21c-f8b6-4b35-b2a3-d420819ac31f', 
  '00798655-f91d-45d4-b1b5-e1dfc1a47266', 
  'a56f0048-20cc-48e3-a9f3-878d1d2f7aab'
) 
OR reference_type = 'adjustment';

-- 4. إضافة الحركات النقدية الصحيحة (المبلغ المستلم فعلياً = إجمالي - رسوم التوصيل)
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
  'إيراد طلب ORD000001: المستلم 50,000 (الإجمالي 55,000 - التوصيل 5,000)',
  5000000,
  5050000,
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
  'إيراد طلب ORD000002: المستلم 50,000 (الإجمالي 55,000 - التوصيل 5,000)',
  5050000,
  5100000,
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
  'إيراد طلب ORD000004: المستلم 21,000 (الإجمالي 26,000 - التوصيل 5,000)',
  5100000,
  5121000,
  'fba59dfc-451c-4906-8882-ae4601ff34d4',
  '2025-07-28 00:45:14.326+00'
);

-- 5. تصحيح رصيد القاصة الرئيسية
-- رأس المال: 5,000,000
-- الإيرادات الفعلية: 121,000 (50+50+21)
-- المصاريف العامة: 0 (فقط مستحقات الموظفين)
-- مستحقات الموظفين: 7,000
-- الرصيد النهائي = 5,000,000 + 121,000 - 7,000 = 5,114,000
UPDATE cash_sources 
SET current_balance = 5114000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';