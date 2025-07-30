-- تحويل الفاتورة القديمة RY-EDC11E إلى النظام الجديد
-- أولاً: إنشاء فاتورة حقيقية للفاتورة الموجودة
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
)
SELECT 
  'RY-EDC11E' as invoice_number,
  (metadata->>'employee_id')::uuid as employee_id,
  COALESCE(metadata->>'employee_name', 'احمد') as employee_name,
  amount as total_amount,
  created_at as settlement_date,
  description,
  'cash' as payment_method,
  'تم التحويل من النظام القديم إلى الجديد' as notes,
  created_by,
  created_at
FROM expenses 
WHERE id = '98c74e85-4ab2-4de6-a7d1-c35199edc11e'
AND category = 'مستحقات الموظفين'
ON CONFLICT (invoice_number) DO UPDATE SET
  settlement_date = EXCLUDED.settlement_date,
  total_amount = EXCLUDED.total_amount,
  employee_name = EXCLUDED.employee_name;

-- ثانياً: تحديث المصروف ليحتوي على رقم الفاتورة الحقيقي
UPDATE expenses 
SET receipt_number = 'RY-EDC11E',
    metadata = metadata || jsonb_build_object(
      'converted_to_new_system', true,
      'settlement_invoice_id', (SELECT id FROM settlement_invoices WHERE invoice_number = 'RY-EDC11E'),
      'conversion_date', now()
    )
WHERE id = '98c74e85-4ab2-4de6-a7d1-c35199edc11e';

-- ثالثاً: حذف الدالة القديمة لتجنب التكرار
DROP FUNCTION IF EXISTS pay_employee_dues(uuid, numeric, text, uuid);

-- رابعاً: التحقق من النتيجة
SELECT 
  'settlement_invoices' as table_name,
  invoice_number,
  employee_name,
  total_amount,
  settlement_date,
  'real' as type
FROM settlement_invoices 
WHERE invoice_number = 'RY-EDC11E'

UNION ALL

SELECT 
  'expenses' as table_name,
  receipt_number as invoice_number,
  (metadata->>'employee_name') as employee_name,
  amount as total_amount,
  created_at as settlement_date,
  'legacy' as type
FROM expenses 
WHERE id = '98c74e85-4ab2-4de6-a7d1-c35199edc11e';