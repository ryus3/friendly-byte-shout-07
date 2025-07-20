-- إصلاح شامل للنظام المالي
-- 1. حذف جميع الـ triggers المكررة للمصاريف
DROP TRIGGER IF EXISTS trigger_process_expense_cash_movement ON public.expenses;
DROP TRIGGER IF EXISTS process_expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS expense_cash_movement_trigger ON public.expenses;

-- 2. حذف جميع حركات المصاريف المضاعفة
DELETE FROM public.cash_movements 
WHERE reference_type IN ('expense', 'expense_refund');

-- 3. إعادة ضبط رصيد القاصة الرئيسية للصفر
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 4. إنشاء trigger واحد فقط للمصاريف (محسّن)
CREATE OR REPLACE FUNCTION public.handle_expense_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id UUID;
BEGIN
  -- تجاهل المصاريف النظامية
  IF COALESCE(NEW.expense_type, OLD.expense_type) = 'system' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true;
  
  IF main_cash_source_id IS NULL THEN
    RAISE EXCEPTION 'القاصة الرئيسية غير موجودة';
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    -- سحب مبلغ المصروف الجديد المعتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- إذا تغيرت الحالة من غير معتمد إلى معتمد
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        NEW.amount,
        'out',
        'expense',
        NEW.id,
        'مصروف: ' || NEW.description,
        NEW.created_by
      );
    -- إذا تغيرت الحالة من معتمد إلى غير معتمد
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        OLD.amount,
        'in',
        'expense_refund',
        OLD.id,
        'إلغاء اعتماد مصروف: ' || OLD.description,
        OLD.created_by
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    -- استرداد المبلغ عند حذف مصروف معتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      OLD.amount,
      'in',
      'expense_refund',
      OLD.id,
      'استرداد مصروف محذوف: ' || OLD.description,
      OLD.created_by
    );
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. إنشاء trigger واحد فقط للمصاريف
CREATE TRIGGER trigger_handle_expense_cash_flow
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_cash_flow();

-- 6. حذف المصاريف النظامية المكررة
DELETE FROM public.expenses 
WHERE expense_type = 'system' 
AND category = 'فئات_المصاريف';

-- 7. إضافة فئات المصاريف النظامية مرة واحدة فقط
INSERT INTO public.expenses (category, expense_type, description, amount, status, created_by)
VALUES
  ('فئات_المصاريف', 'system', 'مشتريات', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'شحن ونقل', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'رواتب', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'إيجار', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'صيانة', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'مستلزمات مكتبية', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'دعاية وإعلان', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604')
ON CONFLICT DO NOTHING;