-- ربط فاتورة التسوية RY-EDC11E بالطلب والربح الحقيقي
UPDATE settlement_invoices 
SET 
  order_ids = ARRAY['a56f0048-20cc-48e3-a9f3-878d1d2f7aab'::uuid],
  profit_ids = ARRAY['993d7dd9-79a8-47e0-91b4-730dd65c8bae'::uuid],
  settled_orders = jsonb_build_array(
    jsonb_build_object(
      'order_id', 'a56f0048-20cc-48e3-a9f3-878d1d2f7aab',
      'order_number', 'ORD000004',
      'customer_name', 'زين العابدين',
      'total_amount', 26000,
      'employee_profit', 7000,
      'profit_rule_applied', 'قاعدة منتج مخصصة - 7000 د.ع ثابت'
    )
  ),
  updated_at = now()
WHERE invoice_number = 'RY-EDC11E';

-- تحديث حالة الربح لتصبح مسوّاة
UPDATE profits 
SET 
  status = 'settled',
  settled_at = '2025-07-28 03:10:00.533939+00',
  updated_at = now()
WHERE id = '993d7dd9-79a8-47e0-91b4-730dd65c8bae';