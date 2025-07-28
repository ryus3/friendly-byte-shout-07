-- إصلاح دالة النظام المحسن لتشمل مستحقات الموظفين
CREATE OR REPLACE FUNCTION public.calculate_enhanced_main_cash_balance()
RETURNS TABLE(
  capital_value NUMERIC,
  total_revenue NUMERIC,
  total_cogs NUMERIC,
  gross_profit NUMERIC,
  total_expenses NUMERIC,
  total_purchases NUMERIC,
  employee_profits NUMERIC,
  net_profit NUMERIC,
  final_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id UUID;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  RETURN QUERY
  WITH financial_data AS (
    -- رأس المال
    SELECT 
      COALESCE((value)::numeric, 0) as capital_amount,
      0::numeric as revenue_amount,
      0::numeric as cogs_amount,
      0::numeric as expense_amount,
      0::numeric as purchase_amount,
      0::numeric as employee_profit_amount
    FROM settings WHERE key = 'initial_capital'
    
    UNION ALL
    
    -- إجمالي الإيرادات من الطلبات المكتملة مع الفواتير المستلمة
    SELECT 
      0::numeric,
      COALESCE(SUM(o.final_amount), 0),
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric
    FROM orders o
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    
    UNION ALL
    
    -- تكلفة البضائع المباعة (COGS)
    SELECT 
      0::numeric,
      0::numeric,
      COALESCE(SUM(pv.cost_price * oi.quantity), 0),
      0::numeric,
      0::numeric,
      0::numeric
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    
    UNION ALL
    
    -- المصاريف العامة (بدون مستحقات الموظفين)
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(amount), 0),
      0::numeric,
      0::numeric
    FROM expenses 
    WHERE status = 'approved' 
    AND expense_type != 'system'
    AND category != 'مستحقات الموظفين'
    
    UNION ALL
    
    -- المشتريات من القاصة الرئيسية
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(total_amount), 0),
      0::numeric
    FROM purchases 
    WHERE cash_source_id = main_cash_id
    
    UNION ALL
    
    -- مستحقات الموظفين المدفوعة (من المصاريف النظامية)
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(amount), 0)
    FROM expenses 
    WHERE status = 'approved' 
    AND expense_type = 'system'
    AND category = 'مستحقات الموظفين'
  )
  SELECT 
    SUM(fd.capital_amount),
    SUM(fd.revenue_amount),
    SUM(fd.cogs_amount),
    SUM(fd.revenue_amount) - SUM(fd.cogs_amount), -- الربح الخام
    SUM(fd.expense_amount),
    SUM(fd.purchase_amount),
    SUM(fd.employee_profit_amount), -- مستحقات الموظفين المدفوعة
    (SUM(fd.revenue_amount) - SUM(fd.cogs_amount)) - SUM(fd.expense_amount) - SUM(fd.employee_profit_amount), -- صافي الربح
    SUM(fd.capital_amount) + (SUM(fd.revenue_amount) - SUM(fd.cogs_amount)) - SUM(fd.expense_amount) - SUM(fd.purchase_amount) - SUM(fd.employee_profit_amount) -- الرصيد النهائي
  FROM financial_data fd;
END;
$$;