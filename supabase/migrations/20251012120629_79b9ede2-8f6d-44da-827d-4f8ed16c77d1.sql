-- المرحلة 1: حذف جميع الحركات الخاطئة
DELETE FROM cash_movements;

-- المرحلة 2: إعادة إنشاء الحركات الصحيحة فقط
DO $$
DECLARE
  v_main_cash_id uuid;
  v_running_balance numeric := 5000000;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO v_main_cash_id 
  FROM cash_sources 
  WHERE name = 'القاصة الرئيسية' 
  LIMIT 1;

  -- 1. ORD000002: +50,000 (2025-07-16)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 50000,
    v_running_balance, v_running_balance + 50000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000002';
  v_running_balance := v_running_balance + 50000;

  -- 2. ORD000001: +50,000 (2025-07-21)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 50000,
    v_running_balance, v_running_balance + 50000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000001';
  v_running_balance := v_running_balance + 50000;

  -- 3. ORD000004: +21,000 (2025-07-28)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 21000,
    v_running_balance, v_running_balance + 21000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000004';
  v_running_balance := v_running_balance + 21000;

  -- 4. مستحقات احمد: -7,000 (2025-07-28)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'out', 7000,
    v_running_balance, v_running_balance - 7000,
    'expense', e.id, e.description,
    e.created_at, e.created_by
  FROM expenses e
  WHERE e.description LIKE '%دفع مستحقات الموظف احمد%';
  v_running_balance := v_running_balance - 7000;

  -- 5. ORD000008: +21,000 (2025-09-04)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 21000,
    v_running_balance, v_running_balance + 21000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000008';
  v_running_balance := v_running_balance + 21000;

  -- 6. ORD000005: +21,000 (2025-09-07)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 21000,
    v_running_balance, v_running_balance + 21000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000005';
  v_running_balance := v_running_balance + 21000;

  -- 7. مستحقات RYUS-299923: -7,000 (2025-09-08)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'out', 7000,
    v_running_balance, v_running_balance - 7000,
    'expense', e.id, e.description,
    e.created_at, e.created_by
  FROM expenses e
  WHERE e.description LIKE '%مستحقات موظفين - طلب RYUS-299923%';
  v_running_balance := v_running_balance - 7000;

  -- 8. ORD000013: +15,000 (2025-09-13)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 15000,
    v_running_balance, v_running_balance + 15000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000013';
  v_running_balance := v_running_balance + 15000;

  -- 9. ORD000010: +21,000 (2025-09-19)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 21000,
    v_running_balance, v_running_balance + 21000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000010';
  v_running_balance := v_running_balance + 21000;

  -- 10. ORD000015: +15,000 (2025-09-23)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 15000,
    v_running_balance, v_running_balance + 15000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000015';
  v_running_balance := v_running_balance + 15000;

  -- 11. ORD000069: +15,000 (2025-10-10)
  INSERT INTO cash_movements (
    cash_source_id, movement_type, amount, 
    balance_before, balance_after, 
    reference_type, reference_id, description,
    effective_at, created_by
  )
  SELECT 
    v_main_cash_id, 'in', 15000,
    v_running_balance, v_running_balance + 15000,
    'order', o.id, 'مبيعات - طلب ' || o.order_number,
    o.receipt_received_at, o.created_by
  FROM orders o
  WHERE o.order_number = 'ORD000069';
  v_running_balance := v_running_balance + 15000;

  -- المرحلة 3: تحديث الرصيد النهائي
  UPDATE cash_sources
  SET current_balance = 5215000,
      updated_at = now()
  WHERE name = 'القاصة الرئيسية';

END $$;