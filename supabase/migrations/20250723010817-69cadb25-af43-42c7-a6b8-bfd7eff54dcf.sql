-- تصفير جميع الحركات في القاصة الرئيسية واستعادة رأس المال فقط
DELETE FROM public.cash_movements 
WHERE cash_source_id = (
  SELECT id FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true
);

-- إعادة تعيين رصيد القاصة الرئيسية لرأس المال فقط
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية' AND is_active = true;

-- حذف جميع المصاريف المرتبطة بالمشتريات المكررة
DELETE FROM public.expenses 
WHERE receipt_number LIKE 'PUR-%' 
OR receipt_number ~ '^[0-9]+-(SHIP|TRANSFER)$';