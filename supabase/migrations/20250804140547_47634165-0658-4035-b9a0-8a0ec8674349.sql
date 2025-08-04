-- حذف الدالة الموجودة وإعادة إنشائها للبيانات الحقيقية فقط
DROP FUNCTION IF EXISTS public.calculate_enhanced_main_cash_balance();

-- إنشاء دالة جديدة لحساب البيانات الحقيقية فقط
CREATE OR REPLACE FUNCTION public.calculate_enhanced_main_cash_balance()
RETURNS TABLE(
  final_balance numeric,
  capital_value numeric,
  system_profit numeric,
  total_revenue numeric,
  total_expenses numeric,
  employee_dues_paid numeric,
  purchase_amounts numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  capital_amount numeric := 0;
  profit_amount numeric := 0;
  revenue_amount numeric := 0;
  expenses_amount numeric := 0;
  dues_paid_amount numeric := 0;
  purchase_amount numeric := 0;
  balance_result numeric := 0;
BEGIN
  -- 1. حساب رأس المال من حركات رأس المال الفعلية فقط
  SELECT COALESCE(SUM(
    CASE 
      WHEN cm.movement_type = 'in' AND cm.reference_type = 'capital_injection' THEN cm.amount
      WHEN cm.movement_type = 'out' AND cm.reference_type = 'capital_withdrawal' THEN -cm.amount
      ELSE 0
    END
  ), 0) INTO capital_amount
  FROM cash_movements cm
  JOIN cash_sources cs ON cm.cash_source_id = cs.id
  WHERE cs.name = 'القاصة الرئيسية'
  AND cm.reference_type IN ('capital_injection', 'capital_withdrawal');

  -- 2. حساب الإيرادات من الطلبات المكتملة والمستلمة فقط
  SELECT COALESCE(SUM(o.total_amount), 0) INTO revenue_amount
  FROM orders o
  WHERE o.status IN ('completed', 'delivered')
  AND o.receipt_received = true;

  -- 3. حساب المصاريف المعتمدة فقط (بدون المستحقات)
  SELECT COALESCE(SUM(e.amount), 0) INTO expenses_amount
  FROM expenses e
  WHERE e.status = 'approved'
  AND e.expense_type != 'system'
  AND e.category != 'مستحقات الموظفين';

  -- 4. حساب المستحقات المدفوعة فعلياً
  SELECT COALESCE(SUM(e.amount), 0) INTO dues_paid_amount
  FROM expenses e
  WHERE e.status = 'approved'
  AND (e.expense_type = 'system' OR e.category = 'مستحقات الموظفين');

  -- 5. حساب قيمة المشتريات المدفوعة
  SELECT COALESCE(SUM(p.total_amount), 0) INTO purchase_amount
  FROM purchases p
  WHERE p.status = 'completed'
  AND p.cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1);

  -- 6. حساب الأرباح الصافية
  profit_amount := revenue_amount - expenses_amount - dues_paid_amount - purchase_amount;

  -- 7. حساب الرصيد النهائي (رأس المال + الأرباح الصافية)
  balance_result := capital_amount + profit_amount;

  RETURN QUERY SELECT 
    balance_result as final_balance,
    capital_amount as capital_value,
    profit_amount as system_profit,
    revenue_amount as total_revenue,
    expenses_amount as total_expenses,
    dues_paid_amount as employee_dues_paid,
    purchase_amount as purchase_amounts;
END;
$function$;

-- تحديث رصيد القاصة الرئيسية بالقيمة الحقيقية
DO $$
DECLARE
  main_cash_id uuid;
  real_balance numeric;
BEGIN
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    SELECT final_balance INTO real_balance FROM calculate_enhanced_main_cash_balance();
    
    UPDATE cash_sources 
    SET current_balance = real_balance, updated_at = now()
    WHERE id = main_cash_id;
    
    RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية إلى: %', real_balance;
  END IF;
END $$;