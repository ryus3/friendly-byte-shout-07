-- إصلاح الدوال المتبقية - الجزء الأول

-- إصلاح calculate_main_cash_balance
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
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  SELECT COALESCE((value)::numeric, 0) INTO capital_value FROM public.settings WHERE key = 'initial_capital';
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses FROM public.expenses WHERE status = 'approved' AND expense_type != 'system';
  SELECT COALESCE(SUM(p.profit_amount - p.employee_profit), 0) INTO total_manager_profits
  FROM public.profits p JOIN public.orders o ON p.order_id = o.id WHERE o.status = 'completed' AND o.receipt_received = true;
  SELECT COALESCE(SUM(total_amount), 0) INTO total_purchase_costs FROM public.purchases WHERE cash_source_id = main_cash_id;
  result_balance := capital_value + total_manager_profits - total_expenses - total_purchase_costs;
  RETURN result_balance;
END;
$function$;

-- إصلاح check_user_permission
DROP FUNCTION IF EXISTS public.check_user_permission(uuid, text);
CREATE OR REPLACE FUNCTION public.check_user_permission(p_user_id uuid, p_permission_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id 
        AND p.name = p_permission_name
        AND ur.is_active = true
        AND p.is_active = true
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$function$;

-- إصلاح check_user_role
DROP FUNCTION IF EXISTS public.check_user_role(uuid, text);
CREATE OR REPLACE FUNCTION public.check_user_role(p_user_id uuid, p_role_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
        AND r.name = p_role_name
        AND ur.is_active = true
        AND r.is_active = true
    );
END;
$function$;

-- إصلاح cleanup_old_backups
DROP FUNCTION IF EXISTS public.cleanup_old_backups();
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.system_backups 
  WHERE created_at < now() - interval '30 days'
  AND is_auto_backup = true;
  
  DELETE FROM public.system_backups 
  WHERE id NOT IN (
    SELECT id FROM public.system_backups 
    WHERE is_auto_backup = false
    ORDER BY created_at DESC 
    LIMIT 10
  ) AND is_auto_backup = false;
  
  RAISE NOTICE 'تم تنظيف النسخ الاحتياطية القديمة';
END;
$function$;