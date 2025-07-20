-- إصلاح القاصة الرئيسية وتحديث رأس المال
-- أولاً: تحديث القاصة الرئيسية لتعكس رأس المال الصحيح
UPDATE public.cash_sources 
SET 
  initial_balance = 5000000,
  current_balance = 5000000,
  updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- ثانياً: حذف أي حركات رأس مال سابقة للقاصة الرئيسية
DELETE FROM public.cash_movements 
WHERE cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية')
AND reference_type IN ('initial_capital', 'capital_adjustment');

-- ثالثاً: إضافة حركة رأس المال الأولية
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
) 
SELECT 
  id,
  5000000,
  'in',
  'initial_capital',
  gen_random_uuid(),
  'رأس المال الابتدائي',
  0,
  5000000,
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid
FROM public.cash_sources 
WHERE name = 'القاصة الرئيسية';

-- رابعاً: التأكد من أن التريجر يعمل بشكل صحيح
-- فحص وجود التريجر
DO $$
BEGIN
  -- حذف التريجر إذا كان موجوداً
  DROP TRIGGER IF EXISTS trigger_update_main_cash_on_capital_change ON public.settings;
  
  -- إعادة إنشاء التريجر
  CREATE TRIGGER trigger_update_main_cash_on_capital_change
    AFTER UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_main_cash_on_capital_change();
END $$;