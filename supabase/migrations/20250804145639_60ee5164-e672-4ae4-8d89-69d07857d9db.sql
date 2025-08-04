-- إضافة trigger لربط المصاريف العامة بحركات النقد تلقائياً
CREATE OR REPLACE FUNCTION public.handle_expense_cash_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id uuid;
  movement_result jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NULL THEN
    RAISE WARNING 'القاصة الرئيسية غير موجودة';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- عند إضافة مصروف عام معتمد
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.expense_type != 'system' AND NEW.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(
      main_cash_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    ) INTO movement_result;
    
    RAISE NOTICE 'تم تسجيل حركة نقدية للمصروف: %', movement_result;
    RETURN NEW;
  END IF;
  
  -- عند تحديث حالة مصروف إلى معتمد
  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.expense_type != 'system' AND NEW.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(
      main_cash_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    ) INTO movement_result;
    
    RAISE NOTICE 'تم تسجيل حركة نقدية للمصروف المعتمد: %', movement_result;
    RETURN NEW;
  END IF;
  
  -- عند حذف مصروف عام معتمد
  IF TG_OP = 'DELETE' AND OLD.status = 'approved' AND OLD.expense_type != 'system' AND OLD.category != 'مستحقات الموظفين' THEN
    SELECT public.update_cash_source_balance(
      main_cash_id,
      OLD.amount,
      'in',
      'expense_refund',
      OLD.id,
      'إرجاع مصروف محذوف: ' || OLD.description,
      OLD.created_by
    ) INTO movement_result;
    
    RAISE NOTICE 'تم تسجيل حركة إرجاع للمصروف المحذوف: %', movement_result;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إنشاء المحفزات
DROP TRIGGER IF EXISTS trigger_expense_cash_movement ON public.expenses;

CREATE TRIGGER trigger_expense_cash_movement
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_cash_movement();

-- تحديث الدالة لتتجاهل المصاريف العامة في الحساب لأنها ستكون في حركات النقد
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
  purchases_amount numeric := 0;
  dues_paid numeric := 0;
  main_cash_balance numeric := 0;
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
  
  -- 3. حساب المشتريات من القاصة الرئيسية
  SELECT COALESCE(SUM(p.total_amount), 0) INTO purchases_amount
  FROM purchases p
  JOIN cash_sources cs ON p.cash_source_id = cs.id
  WHERE cs.name = 'القاصة الرئيسية';
  
  -- 4. حساب مستحقات الموظفين المدفوعة
  SELECT COALESCE(SUM(e.amount), 0) INTO dues_paid
  FROM expenses e
  WHERE e.expense_type = 'system'
  AND e.category = 'مستحقات الموظفين'
  AND e.status = 'approved';
  
  -- 5. الحصول على الرصيد الفعلي من القاصة الرئيسية (يشمل المصاريف عبر حركات النقد)
  SELECT COALESCE(current_balance, 0) INTO main_cash_balance
  FROM cash_sources 
  WHERE name = 'القاصة الرئيسية';
  
  -- الرصيد النهائي هو الرصيد الفعلي من القاصة
  RETURN QUERY SELECT 
    main_cash_balance,              -- final_balance
    capital_value,                  -- capital_amount  
    main_cash_balance - capital_value, -- net_profit
    sales_amount,                   -- total_sales
    0::numeric,                     -- total_expenses (الآن في حركات النقد)
    purchases_amount,               -- total_purchases
    dues_paid;                      -- employee_dues_paid
END;
$$;