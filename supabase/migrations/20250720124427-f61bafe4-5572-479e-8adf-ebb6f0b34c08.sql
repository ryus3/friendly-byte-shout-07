-- إصلاح الدالة - مشكلة في استخدام SUM في UPDATE
DROP FUNCTION IF EXISTS public.update_main_cash_on_capital_change();

CREATE OR REPLACE FUNCTION public.update_main_cash_on_capital_change()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  new_capital_value numeric := 0;
  other_movements_total numeric := 0;
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
    
    -- الحصول على القيمة الجديدة لرأس المال
    new_capital_value := COALESCE((NEW.value)::numeric, 0);
    
    RAISE NOTICE 'تحديث رأس المال إلى: %', new_capital_value;
    
    -- حذف جميع حركات رأس المال السابقة
    DELETE FROM public.cash_movements 
    WHERE cash_source_id = main_cash_source_id 
    AND reference_type IN ('initial_capital', 'capital_adjustment');
    
    -- حساب مجموع الحركات الأخرى (غير رأس المال)
    SELECT COALESCE(SUM(
      CASE 
        WHEN movement_type = 'in' THEN amount
        WHEN movement_type = 'out' THEN -amount
        ELSE 0
      END
    ), 0) INTO other_movements_total
    FROM public.cash_movements 
    WHERE cash_source_id = main_cash_source_id
    AND reference_type NOT IN ('initial_capital', 'capital_adjustment');
    
    -- تحديث الرصيد الابتدائي للقاصة الرئيسية
    UPDATE public.cash_sources
    SET 
      initial_balance = new_capital_value,
      current_balance = new_capital_value + other_movements_total,
      updated_at = now()
    WHERE id = main_cash_source_id;
    
    -- إضافة حركة رأس المال الجديدة
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
      new_capital_value,
      'in',
      'initial_capital',
      gen_random_uuid(),
      'رأس المال المُحدّث',
      0,
      new_capital_value,
      COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
    );
    
    RAISE NOTICE 'تم تحديث رأس المال والرصيد بنجاح';
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الترايغر
CREATE TRIGGER trigger_update_main_cash_on_capital_change
  AFTER UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_main_cash_on_capital_change();