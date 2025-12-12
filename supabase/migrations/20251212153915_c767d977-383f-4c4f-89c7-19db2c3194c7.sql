-- تصحيح الأرباح الخاطئة المسجلة للموظف أحمد بناءً على قواعد الربح الثابتة وتاريخ الطلب

-- 1) تصحيح طلب 115758998 (منتج fba13e37, قاعدة موجودة 2025-12-04, طلب 2025-12-05) = 7000
UPDATE profits 
SET employee_profit = 7000, profit_amount = 7000, status = 'settled'
WHERE order_id = 'b6c55e62-5e7a-4f6e-a3e7-2c370ce00d12';

-- 2) تصحيح طلب 115721565 (منتج fba13e37, قاعدة موجودة, خصم 3000) = 7000 - 3000 = 4000
UPDATE profits 
SET employee_profit = 4000, profit_amount = 4000, status = 'settled'
WHERE order_id = '77ab23d1-5ac7-444c-b31e-eb1536a5033f';

-- 3) تصحيح طلب 109517434 (منتج 9856b274, قاعدة أُنشئت 2025-12-04, طلب 2025-11-01) = 0 (لا قاعدة وقت الطلب)
UPDATE profits 
SET employee_profit = 0, profit_amount = 0, status = 'no_rule_settled'
WHERE order_id = '876b92e6-d11a-4c51-aac4-3f69ea4b22e8';

-- 4) تصحيح طلب 109517436 (منتجين fba13e37+9856b274, كلاهما قاعدة 2025-12-04, طلب 2025-11-01) = 0
UPDATE profits 
SET employee_profit = 0, profit_amount = 0, status = 'no_rule_settled'
WHERE order_id = '16ff5a23-7c8a-41b0-9849-3c3d3fb9739e';

-- 5) تصحيح طلب 102612839 (منتج 44b956b4, قاعدة 2025-09-09, طلب 2025-09-17) = 7000 (قاعدة موجودة)
UPDATE profits 
SET employee_profit = 7000, profit_amount = 7000, status = 'settled'
WHERE order_id = '1cbec33a-f492-4527-a33e-205cf1cbd71b';

-- 6) تصحيح طلب 101264291 (منتج 44b956b4, قاعدة 2025-09-09, طلب 2025-09-08) = 0 (قاعدة بعد الطلب)
UPDATE profits 
SET employee_profit = 0, profit_amount = 0, status = 'no_rule_settled'
WHERE order_id = 'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a';

-- إنشاء فاتورة تسوية للتحاسب الذي تم بشكل خاطئ
-- المبلغ الصحيح: 7000 + 4000 + 0 + 0 + 7000 + 0 = 18000
INSERT INTO settlement_invoices (
  invoice_number,
  employee_id,
  employee_name,
  employee_code,
  order_ids,
  total_amount,
  payment_method,
  status,
  settlement_date,
  description,
  settled_orders,
  created_by
) VALUES (
  'RY-FIXED01',
  'fba59dfc-451c-4906-8882-ae4601ff34d4',
  'احمد',
  'EMP002',
  ARRAY[
    '876b92e6-d11a-4c51-aac4-3f69ea4b22e8'::uuid,
    'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a'::uuid,
    '1cbec33a-f492-4527-a33e-205cf1cbd71b'::uuid,
    '16ff5a23-7c8a-41b0-9849-3c3d3fb9739e'::uuid,
    '77ab23d1-5ac7-444c-b31e-eb1536a5033f'::uuid,
    'b6c55e62-5e7a-4f6e-a3e7-2c370ce00d12'::uuid
  ],
  18000,
  'cash',
  'completed',
  NOW(),
  'تصحيح تحاسب سابق - الأرباح محسوبة من قواعد الربح الثابتة',
  '[
    {"order_id": "b6c55e62-5e7a-4f6e-a3e7-2c370ce00d12", "tracking_number": "115758998", "employee_profit": 7000, "has_rule": true, "discount": 0},
    {"order_id": "77ab23d1-5ac7-444c-b31e-eb1536a5033f", "tracking_number": "115721565", "employee_profit": 4000, "has_rule": true, "discount": 3000},
    {"order_id": "876b92e6-d11a-4c51-aac4-3f69ea4b22e8", "tracking_number": "109517434", "employee_profit": 0, "has_rule": false, "discount": 0},
    {"order_id": "16ff5a23-7c8a-41b0-9849-3c3d3fb9739e", "tracking_number": "109517436", "employee_profit": 0, "has_rule": false, "discount": 0},
    {"order_id": "1cbec33a-f492-4527-a33e-205cf1cbd71b", "tracking_number": "102612839", "employee_profit": 7000, "has_rule": true, "discount": 0},
    {"order_id": "f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a", "tracking_number": "101264291", "employee_profit": 0, "has_rule": false, "discount": 0}
  ]'::jsonb,
  '91484496-b887-44f7-9e5d-be9db5567604'
);

-- إضافة حركة نقد لخصم المستحقات من القاصة (18000 بدلاً من المبلغ الخاطئ)
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  description,
  balance_before,
  balance_after,
  created_by
) 
SELECT 
  id,
  18000,
  'employee_dues',
  'settlement_invoice',
  'دفع مستحقات الموظف احمد - فاتورة RY-FIXED01 (تصحيح)',
  current_balance,
  current_balance - 18000,
  '91484496-b887-44f7-9e5d-be9db5567604'
FROM cash_sources 
WHERE name = 'القاصة الرئيسية' AND is_active = true;

-- تحديث رصيد القاصة
UPDATE cash_sources 
SET current_balance = current_balance - 18000
WHERE name = 'القاصة الرئيسية' AND is_active = true;