-- إصلاح آخر دالتين متبقيتين

-- تحديث calculate_main_cash_balance 
DROP FUNCTION IF EXISTS public.calculate_main_cash_balance();
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  capital_value NUMERIC;
  total_expenses NUMERIC;
  total_manager_profits NUMERIC;
  total_purchase_costs NUMERIC;
  main_cash_id UUID;
  result_balance NUMERIC;
BEGIN
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  SELECT COALESCE((value)::numeric, 0) INTO capital_value FROM settings WHERE key = 'initial_capital';
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses FROM expenses WHERE status = 'approved' AND expense_type != 'system';
  SELECT COALESCE(SUM(p.profit_amount - p.employee_profit), 0) INTO total_manager_profits
  FROM profits p JOIN orders o ON p.order_id = o.id WHERE o.status = 'completed' AND o.receipt_received = true;
  SELECT COALESCE(SUM(total_amount), 0) INTO total_purchase_costs FROM purchases WHERE cash_source_id = main_cash_id;
  result_balance := capital_value + total_manager_profits - total_expenses - total_purchase_costs;
  RETURN result_balance;
END;
$function$;

-- تحديث cleanup_old_backups
DROP FUNCTION IF EXISTS public.cleanup_old_backups();
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM system_backups 
  WHERE created_at < now() - interval '30 days'
  AND is_auto_backup = true;
  
  DELETE FROM system_backups 
  WHERE id NOT IN (
    SELECT id FROM system_backups 
    WHERE is_auto_backup = false
    ORDER BY created_at DESC 
    LIMIT 10
  ) AND is_auto_backup = false;
  
  RAISE NOTICE 'تم تنظيف النسخ الاحتياطية القديمة';
END;
$function$;