-- تنظيف القاصة الرئيسية والمصاريف العامة
-- 1. حذف جميع حركات النقد في القاصة الرئيسية ما عدا رأس المال
DELETE FROM public.cash_movements 
WHERE cash_source_id = (
  SELECT id FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true
)
AND reference_type NOT IN ('initial_capital');

-- 2. تحديث الرصيد الحالي للقاصة الرئيسية ليساوي رأس المال فقط
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية' AND is_active = true;

-- 3. حذف المصاريف العامة (أو تصفيرها حسب الحاجة)
DELETE FROM public.expenses 
WHERE expense_type = 'general' OR category = 'general';

-- 4. حذف المعاملات المالية المرتبطة بالمصاريف المحذوفة
DELETE FROM public.financial_transactions 
WHERE reference_type = 'expense' 
AND reference_id NOT IN (SELECT id FROM public.expenses);

-- إظهار النتيجة النهائية
SELECT 
  name,
  initial_balance as "رأس المال",
  current_balance as "الرصيد الحالي",
  (current_balance - initial_balance) as "الفرق"
FROM public.cash_sources 
WHERE name = 'القاصة الرئيسية';