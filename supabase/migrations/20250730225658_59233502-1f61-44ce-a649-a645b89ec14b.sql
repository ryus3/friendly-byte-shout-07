-- تحويل الفاتورة القديمة RY-EDC11E مع إضافة معرف الموظف الصحيح
-- أولاً: إنشاء فاتورة حقيقية مع معرف الموظف الصحيح
INSERT INTO settlement_invoices (
  invoice_number,
  employee_id,
  employee_name,
  total_amount,
  settlement_date,
  description,
  payment_method,
  notes,
  created_by,
  created_at
) VALUES (
  'RY-EDC11E',
  'fba59dfc-451c-4906-8882-ae4601ff34d4', -- معرف الموظف احمد
  'احمد',
  7000.00,
  '2025-07-28 03:10:00.533939+00',
  'دفع مستحقات الموظف احمد',
  'cash',
  'تم التحويل من النظام القديم إلى الجديد - التاريخ الحقيقي: 28 يوليو 2025 الساعة 03:10',
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-07-28 03:10:00.533939+00'
) ON CONFLICT (invoice_number) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  settlement_date = EXCLUDED.settlement_date,
  total_amount = EXCLUDED.total_amount,
  employee_name = EXCLUDED.employee_name,
  notes = EXCLUDED.notes;

-- ثانياً: تحديث المصروف ليحتوي على رقم الفاتورة والمعرف الصحيح
UPDATE expenses 
SET 
  receipt_number = 'RY-EDC11E',
  metadata = jsonb_build_object(
    'employee_id', 'fba59dfc-451c-4906-8882-ae4601ff34d4',
    'employee_name', 'احمد',
    'converted_to_new_system', true,
    'settlement_invoice_id', (SELECT id FROM settlement_invoices WHERE invoice_number = 'RY-EDC11E'),
    'conversion_date', now(),
    'original_payment_date', '2025-07-28 03:10:00.533939+00'
  )
WHERE id = '98c74e85-4ab2-4de6-a7d1-c35199edc11e';

-- ثالثاً: حذف الدالة القديمة لتجنب التكرار والالتباس
DROP FUNCTION IF EXISTS pay_employee_dues(uuid, numeric, text, uuid);

-- رابعاً: التحقق من النتيجة النهائية
SELECT 
  'النظام الجديد' as source,
  invoice_number,
  employee_name,
  total_amount,
  to_char(settlement_date, 'DD/MM/YYYY HH24:MI') as formatted_date,
  settlement_date,
  'فاتورة حقيقية' as type
FROM settlement_invoices 
WHERE invoice_number = 'RY-EDC11E';