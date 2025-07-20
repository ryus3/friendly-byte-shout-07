-- إنشاء trigger لمعالجة المصاريف والربط مع القاصة الرئيسية
CREATE OR REPLACE FUNCTION public.process_expense_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id UUID;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true;
  
  IF main_cash_source_id IS NULL THEN
    RAISE WARNING 'القاصة الرئيسية غير موجودة';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    -- إنشاء حركة سحب للمصروف المعتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    );
    
    RAISE NOTICE 'تم سحب مصروف: % بقيمة: %', NEW.description, NEW.amount;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- إنشاء حركة سحب عند تغيير حالة المصروف إلى معتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    );
    
    RAISE NOTICE 'تم اعتماد وسحب مصروف: % بقيمة: %', NEW.description, NEW.amount;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- استرداد المبلغ عند حذف المصروف المعتمد
    IF OLD.status = 'approved' THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        OLD.amount,
        'in',
        'expense_refund',
        OLD.id,
        'استرداد مصروف محذوف: ' || OLD.description,
        OLD.created_by
      );
      
      RAISE NOTICE 'تم استرداد مبلغ مصروف محذوف: % بقيمة: %', OLD.description, OLD.amount;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إنشاء Triggers للمصاريف
DROP TRIGGER IF EXISTS trigger_process_expense_cash_movement ON public.expenses;
CREATE TRIGGER trigger_process_expense_cash_movement
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.process_expense_cash_movement();

-- إضافة فئات المصاريف الأساسية
INSERT INTO public.expenses (category, expense_type, description, amount, status, created_by)
VALUES
  ('فئات_المصاريف', 'system', 'مشتريات', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'شحن ونقل', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'تكاليف التحويل', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'تسويق', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'رواتب', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'إيجار', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'فواتير', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'صيانة', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'مستحقات الموظفين', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604'),
  ('فئات_المصاريف', 'system', 'أخرى', 0, 'system', '91484496-b887-44f7-9e5d-be9db5567604')
ON CONFLICT DO NOTHING;