-- إنشاء دالة موحدة لإحصائيات الأرباح والمستحقات
CREATE OR REPLACE FUNCTION public.get_unified_profits_analytics()
RETURNS TABLE(
  -- إحصائيات الأرباح العامة
  total_pending_profits numeric,
  total_settled_profits numeric,
  total_employees_with_profits bigint,
  
  -- الأرباح المعلقة حسب الموظف
  pending_profits_by_employee jsonb,
  
  -- الأرباح المسددة (آخر 50)
  recent_settled_profits jsonb,
  
  -- إحصائيات المستحقات المالية
  financial_summary jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- إحصائيات الأرباح العامة
    COALESCE(SUM(profit_amount) FILTER (WHERE status = 'pending'), 0) as total_pending_profits,
    COALESCE(SUM(profit_amount) FILTER (WHERE status = 'settled'), 0) as total_settled_profits,
    COUNT(DISTINCT employee_id) FILTER (WHERE status = 'pending') as total_employees_with_profits,
    
    -- الأرباح المعلقة حسب الموظف
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'employee_id', p.employee_id,
          'employee_name', pr.full_name,
          'employee_code', pr.employee_code,
          'total_pending_amount', employee_stats.total_pending,
          'total_employee_profit', employee_stats.total_employee_profit,
          'orders_count', employee_stats.orders_count,
          'avg_profit_per_order', 
            CASE 
              WHEN employee_stats.orders_count > 0 
              THEN employee_stats.total_pending / employee_stats.orders_count 
              ELSE 0 
            END
        )
      )
      FROM (
        SELECT 
          employee_id,
          SUM(profit_amount) as total_pending,
          SUM(employee_profit) as total_employee_profit,
          COUNT(*) as orders_count
        FROM profits 
        WHERE status = 'pending'
        GROUP BY employee_id
        ORDER BY total_pending DESC
      ) employee_stats
      JOIN profits p ON p.employee_id = employee_stats.employee_id
      JOIN profiles pr ON pr.user_id = employee_stats.employee_id
      GROUP BY employee_stats.employee_id, employee_stats.total_pending, 
               employee_stats.total_employee_profit, employee_stats.orders_count, pr.full_name, pr.employee_code
    ) as pending_profits_by_employee,
    
    -- الأرباح المسددة الحديثة
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'invoice_number', si.invoice_number,
          'employee_name', si.employee_name,
          'employee_code', si.employee_code,
          'total_amount', si.total_amount,
          'settlement_date', si.settlement_date,
          'status', si.status,
          'payment_method', si.payment_method
        )
        ORDER BY si.settlement_date DESC
      )
      FROM (
        SELECT *
        FROM settlement_invoices 
        WHERE status = 'completed'
        ORDER BY settlement_date DESC
        LIMIT 50
      ) si
    ) as recent_settled_profits,
    
    -- ملخص مالي شامل
    (
      SELECT jsonb_build_object(
        -- ملخص الأرباح
        'profits_summary', jsonb_build_object(
          'total_pending_amount', COALESCE(SUM(profit_amount) FILTER (WHERE status = 'pending'), 0),
          'total_settled_amount', COALESCE(SUM(profit_amount) FILTER (WHERE status = 'settled'), 0),
          'pending_employee_profits', COALESCE(SUM(employee_profit) FILTER (WHERE status = 'pending'), 0),
          'settled_employee_profits', COALESCE(SUM(employee_profit) FILTER (WHERE status = 'settled'), 0)
        ),
        
        -- ملخص الطلبات
        'orders_summary', jsonb_build_object(
          'orders_with_pending_profits', COUNT(DISTINCT order_id) FILTER (WHERE status = 'pending'),
          'orders_with_settled_profits', COUNT(DISTINCT order_id) FILTER (WHERE status = 'settled')
        ),
        
        -- ملخص الموظفين
        'employees_summary', jsonb_build_object(
          'employees_with_pending_profits', COUNT(DISTINCT employee_id) FILTER (WHERE status = 'pending'),
          'employees_with_settled_profits', COUNT(DISTINCT employee_id) FILTER (WHERE status = 'settled')
        )
      )
      FROM profits
    ) as financial_summary
    
  FROM profits;