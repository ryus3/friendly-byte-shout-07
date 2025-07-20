-- التحقق من وجود trigger تحديث القاصة الرئيسية وإصلاحه
-- إصلاح trigger تحديث القاصة الرئيسية عند تعديل رأس المال

-- حذف trigger القديم إذا كان موجود
DROP TRIGGER IF EXISTS trigger_update_main_cash_on_capital_change ON public.settings;
DROP FUNCTION IF EXISTS public.update_main_cash_on_capital_change();

-- إنشاء دالة جديدة لتحديث القاصة الرئيسية عند تغيير رأس المال
CREATE OR REPLACE FUNCTION public.update_main_cash_on_capital_change()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  old_capital_value numeric := 0;
  new_capital_value numeric := 0;
  capital_difference numeric := 0;
BEGIN
  -- تحقق من أن التحديث لرأس المال
  IF NEW.key = 'initial_capital' AND OLD.key = 'initial_capital' THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true
    LIMIT 1;
    
    IF main_cash_source_id IS NULL THEN
      RAISE WARNING 'القاصة الرئيسية غير موجودة';
      RETURN NEW;
    END IF;
    
    -- الحصول على القيم القديمة والجديدة
    old_capital_value := COALESCE((OLD.value)::numeric, 0);
    new_capital_value := COALESCE((NEW.value)::numeric, 0);
    capital_difference := new_capital_value - old_capital_value;
    
    RAISE NOTICE 'تحديث رأس المال: من % إلى %, الفرق: %', old_capital_value, new_capital_value, capital_difference;
    
    -- تحديث الرصيد الابتدائي للقاصة الرئيسية
    UPDATE public.cash_sources
    SET 
      initial_balance = new_capital_value,
      updated_at = now()
    WHERE id = main_cash_source_id;
    
    -- إضافة حركة نقدية لتسجيل التغيير
    IF capital_difference != 0 THEN
      INSERT INTO public.cash_movements (
        cash_source_id,
        amount,
        movement_type,
        reference_type,
        reference_id,
        description,
        balance_before,
        balance_after,
        created_by
      ) VALUES (
        main_cash_source_id,
        ABS(capital_difference),
        CASE WHEN capital_difference > 0 THEN 'in' ELSE 'out' END,
        'capital_adjustment',
        gen_random_uuid(),
        CASE 
          WHEN capital_difference > 0 THEN 'زيادة رأس المال'
          ELSE 'تقليل رأس المال'
        END,
        old_capital_value,
        new_capital_value,
        COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
      );
      
      RAISE NOTICE 'تم إضافة حركة نقدية للتغيير: %', capital_difference;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء trigger جديد
CREATE TRIGGER trigger_update_main_cash_on_capital_change
  AFTER UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_main_cash_on_capital_change();