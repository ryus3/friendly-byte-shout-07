-- إصلاح هيكل settled_orders في فواتير التسوية الموجودة
-- تحديث الفواتير التي لديها settled_orders بشكل غير منتظم

UPDATE settlement_invoices 
SET settled_orders = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'order_id', p.order_id,
      'order_number', COALESCE(o.order_number, o.tracking_number, 'N/A'),
      'customer_name', COALESCE(o.customer_name, 'غير محدد'),
      'order_total', p.total_revenue,
      'total_cost', p.total_cost,
      'employee_profit', p.employee_profit,
      'order_date', o.created_at
    )
  )
  FROM profits p
  LEFT JOIN orders o ON o.id = p.order_id
  WHERE p.employee_id = settlement_invoices.employee_id
    AND p.status = 'settled'
    AND p.settled_at IS NOT NULL
    AND p.settled_at::date = settlement_invoices.settlement_date::date
)
WHERE settled_orders IS NULL 
   OR jsonb_array_length(settled_orders) = 0 
   OR NOT jsonb_path_exists(settled_orders, '$[0].order_total');

-- إصلاح عدد الموظفين الفريدة في إحصائيات التطبيق
-- إنشاء دالة لحساب الموظفين الفريدة بناءً على employee_id
CREATE OR REPLACE FUNCTION get_unique_employees_count_with_settlements()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT employee_id)
    FROM settlement_invoices
    WHERE employee_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;