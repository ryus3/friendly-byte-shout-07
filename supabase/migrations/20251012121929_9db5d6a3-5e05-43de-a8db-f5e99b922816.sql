-- حذف جميع حركات النقد الحالية
DELETE FROM cash_movements;

-- إنشاء الحركات النقدية الصحيحة بالتواريخ والبيانات الفعلية

-- 1. مبيعات - طلب RYUS-042031 (16/07/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  50000,
  5000000,
  5050000,
  'مبيعات - طلب RYUS-042031',
  '2025-07-16 00:17:04+00',
  o.created_by,
  '2025-07-16 00:17:04+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-042031'
LIMIT 1;

-- 2. مبيعات - طلب RYUS-059177 (21/07/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  50000,
  5050000,
  5100000,
  'مبيعات - طلب RYUS-059177',
  '2025-07-21 00:06:27+00',
  o.created_by,
  '2025-07-21 00:06:27+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-059177'
LIMIT 1;

-- 3. مبيعات - طلب RYUS-415487 (28/07/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  21000,
  5100000,
  5121000,
  'مبيعات - طلب RYUS-415487',
  '2025-07-28 00:45:14+00',
  o.created_by,
  '2025-07-28 00:45:14+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-415487'
LIMIT 1;

-- 4. دفع مستحقات - طلب RYUS-415487 (28/07/2025 03:10)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  p.id,
  'expense',
  'expense',
  7000,
  5121000,
  5114000,
  'دفع مستحقات موظف - طلب RYUS-415487',
  '2025-07-28 03:10:00+00',
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  '2025-07-28 03:10:00+00'
FROM cash_sources cs
CROSS JOIN profits p
JOIN orders o ON p.order_id = o.id
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-415487'
  AND p.employee_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid
LIMIT 1;

-- 5. مبيعات - طلب 98713588 (04/09/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  21000,
  5114000,
  5135000,
  'مبيعات - طلب 98713588',
  '2025-09-04 15:23:11+00',
  o.created_by,
  '2025-09-04 15:23:11+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = '98713588'
LIMIT 1;

-- 6. مبيعات - طلب RYUS-299923 (07/09/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  21000,
  5135000,
  5156000,
  'مبيعات - طلب RYUS-299923',
  '2025-09-07 15:20:56+00',
  o.created_by,
  '2025-09-07 15:20:56+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-299923'
LIMIT 1;

-- 7. دفع مستحقات - طلب RYUS-299923 (08/09/2025 14:42)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  p.id,
  'expense',
  'expense',
  7000,
  5156000,
  5149000,
  'دفع مستحقات موظف - طلب RYUS-299923',
  '2025-09-08 14:42:16+00',
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  '2025-09-08 14:42:16+00'
FROM cash_sources cs
CROSS JOIN profits p
JOIN orders o ON p.order_id = o.id
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = 'RYUS-299923'
  AND p.employee_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid
LIMIT 1;

-- 8. مبيعات - طلب 101264291 (13/09/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  15000,
  5149000,
  5164000,
  'مبيعات - طلب 101264291',
  '2025-09-13 17:05:05+00',
  o.created_by,
  '2025-09-13 17:05:05+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = '101264291'
LIMIT 1;

-- 9. مبيعات - طلب 98783797 (19/09/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  21000,
  5164000,
  5185000,
  'مبيعات - طلب 98783797',
  '2025-09-19 22:45:09+00',
  o.created_by,
  '2025-09-19 22:45:09+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = '98783797'
LIMIT 1;

-- 10. مبيعات - طلب 102612839 (23/09/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  15000,
  5185000,
  5200000,
  'مبيعات - طلب 102612839',
  '2025-09-23 17:09:26+00',
  o.created_by,
  '2025-09-23 17:09:26+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = '102612839'
LIMIT 1;

-- 11. مبيعات - طلب 106246427 (10/10/2025)
INSERT INTO cash_movements (
  cash_source_id,
  reference_id,
  reference_type,
  movement_type,
  amount,
  balance_before,
  balance_after,
  description,
  effective_at,
  created_by,
  created_at
) 
SELECT 
  cs.id,
  o.id,
  'order',
  'income',
  15000,
  5200000,
  5215000,
  'مبيعات - طلب 106246427',
  '2025-10-10 00:50:29+00',
  o.created_by,
  '2025-10-10 00:50:29+00'
FROM cash_sources cs
CROSS JOIN orders o
WHERE cs.name = 'القاصة الرئيسية'
  AND o.tracking_number = '106246427'
LIMIT 1;

-- تحديث رصيد القاصة الرئيسية إلى 5,215,000 د.ع
UPDATE cash_sources 
SET current_balance = 5215000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';