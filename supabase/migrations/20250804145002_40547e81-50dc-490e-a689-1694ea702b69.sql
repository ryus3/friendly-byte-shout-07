-- تحديث الدالة لتأخذ رأس المال من جدول settings
CREATE OR REPLACE FUNCTION public.calculate_real_main_cash_balance()
 RETURNS TABLE(
   final_balance numeric,
   capital_amount numeric,
   net_profit numeric,
   total_sales numeric,
   total_expenses numeric,
   total_purchases numeric,
   employee_dues_paid numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  capital_value numeric := 0;
  sales_amount numeric := 0;
  expenses_amount numeric := 0;
  purchases_amount numeric := 0;
  dues_paid numeric := 0;
  profit_amount numeric := 0;
  final_amount numeric := 0;
BEGIN
  -- 1. الحصول على رأس المال من جدول settings
  SELECT COALESCE((value)::numeric, 0) INTO capital_value 
  FROM settings 
  WHERE key = 'initial_capital';
  
  -- 2. حساب إجمالي المبيعات المستلمة (بدون رسوم التوصيل)
  SELECT COALESCE(SUM(o.total_amount - COALESCE(o.delivery_fee, 0)), 0) INTO sales_amount
  FROM orders o
  WHERE o.status IN ('completed', 'delivered')
  AND o.receipt_received = true;
  
  -- 3. حساب المصاريف العامة (بدون مستحقات الموظفين)
  SELECT COALESCE(SUM(e.amount), 0) INTO expenses_amount
  FROM expenses e
  WHERE e.status = 'approved'
  AND e.expense_type != 'system'
  AND e.category != 'مستحقات الموظفين';
  
  -- 4. حساب المشتريات من القاصة الرئيسية
  SELECT COALESCE(SUM(p.total_amount), 0) INTO purchases_amount
  FROM purchases p
  JOIN cash_sources cs ON p.cash_source_id = cs.id
  WHERE cs.name = 'القاصة الرئيسية';
  
  -- 5. حساب مستحقات الموظفين المدفوعة
  SELECT COALESCE(SUM(e.amount), 0) INTO dues_paid
  FROM expenses e
  WHERE e.expense_type = 'system'
  AND e.category = 'مستحقات الموظفين'
  AND e.status = 'approved';
  
  -- 6. حساب صافي الربح
  profit_amount := sales_amount - expenses_amount - purchases_amount - dues_paid;
  
  -- 7. حساب الرصيد النهائي
  final_amount := capital_value + profit_amount;
  
  RETURN QUERY SELECT 
    final_amount,
    capital_value,
    profit_amount,
    sales_amount,
    expenses_amount,
    purchases_amount,
    dues_paid;
END;
$$;