-- تحديث دالة حساب الرصيد المحسن لتشمل المصاريف العامة الحديثة
CREATE OR REPLACE FUNCTION public.calculate_enhanced_main_cash_balance_v3()
RETURNS TABLE(
  capital_value numeric, 
  total_revenue numeric, 
  total_cogs numeric, 
  gross_profit numeric, 
  total_expenses numeric, 
  total_purchases numeric, 
  employee_profits numeric, 
  net_profit numeric, 
  final_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    
    -- إجمالي الإيرادات من الطلبات المكتملة (المبلغ المستلم فعلياً بدون رسوم التوصيل)
    SELECT 
      0::numeric,
      COALESCE(SUM(o.total_amount - o.delivery_fee), 0), -- المبلغ بدون رسوم التوصيل
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric
    FROM orders o
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    
    UNION ALL
    
    -- تكلفة البضائع المباعة (COGS) - للطلبات المكتملة فقط
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
    
    -- جميع المصاريف العامة التشغيلية (بما في ذلك أحدث المصاريف)
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(amount), 0),
      0::numeric,
      0::numeric
    FROM expenses 
    WHERE status = 'approved' 
    AND expense_type = 'operational' -- المصاريف التشغيلية فقط
    
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
    
    -- مستحقات الموظفين المدفوعة (من المصاريف النظامية فقط)
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
    SUM(fd.capital_amount), -- رأس المال
    SUM(fd.revenue_amount), -- إجمالي الإيرادات
    SUM(fd.cogs_amount), -- تكلفة البضائع المباعة
    SUM(fd.revenue_amount) - SUM(fd.cogs_amount), -- الربح الخام
    SUM(fd.expense_amount), -- إجمالي المصاريف العامة (المحدثة)
    SUM(fd.purchase_amount), -- إجمالي المشتريات
    SUM(fd.employee_profit_amount), -- مستحقات الموظفين المدفوعة
    (SUM(fd.revenue_amount) - SUM(fd.cogs_amount)) - SUM(fd.expense_amount), -- صافي الربح بعد خصم المصاريف العامة
    SUM(fd.capital_amount) + (SUM(fd.revenue_amount) - SUM(fd.cogs_amount)) - SUM(fd.expense_amount) - SUM(fd.purchase_amount) - SUM(fd.employee_profit_amount) -- الرصيد النهائي
  FROM financial_data fd;
END;
$function$;

-- تحديث الدالة الرئيسية لاستخدام النسخة الجديدة
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance_v3()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_data record;
BEGIN
  SELECT * INTO result_data FROM calculate_enhanced_main_cash_balance_v3();
  RETURN result_data.final_balance;
END;
$function$;