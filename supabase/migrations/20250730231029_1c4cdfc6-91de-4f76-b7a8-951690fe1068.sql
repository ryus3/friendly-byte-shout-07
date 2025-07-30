-- إضافة عمود معرف الموظف الصغير لجدول فواتير التسوية
ALTER TABLE settlement_invoices 
ADD COLUMN IF NOT EXISTS employee_code TEXT;

-- تحديث فاتورة RY-EDC11E بالمعرف الصغير الجديد
UPDATE settlement_invoices 
SET employee_code = 'EMP002'
WHERE invoice_number = 'RY-EDC11E';

-- إضافة الطلبات المسواة للفاتورة
WITH ahmed_profits AS (
  SELECT p.*, o.order_number, o.customer_name, o.total_amount as order_total
  FROM profits p
  JOIN orders o ON p.order_id = o.id
  WHERE p.employee_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'
  AND p.status = 'settled'
  AND p.settled_at IS NOT NULL
)
UPDATE settlement_invoices 
SET settled_orders = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'order_id', ap.order_id,
      'order_number', ap.order_number,
      'customer_name', ap.customer_name,
      'order_total', ap.order_total,
      'employee_profit', ap.employee_profit,
      'total_revenue', ap.total_revenue,
      'total_cost', ap.total_cost
    )
  ), '[]'::jsonb)
  FROM ahmed_profits ap
)
WHERE invoice_number = 'RY-EDC11E';

-- فحص النتيجة النهائية
SELECT 
  invoice_number,
  employee_name,
  employee_code,
  total_amount,
  to_char(settlement_date, 'DD/MM/YYYY HH24:MI') as settlement_date_formatted,
  jsonb_array_length(COALESCE(settled_orders, '[]'::jsonb)) as orders_count,
  'تحديث مكتمل' as status
FROM settlement_invoices 
WHERE invoice_number = 'RY-EDC11E';