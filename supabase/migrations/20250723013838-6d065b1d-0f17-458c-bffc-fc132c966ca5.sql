-- إضافة الحركة المفقودة للطلب الثاني
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
  cs.id,
  21000,
  'in',
  'realized_profit',
  o.id,
  'ربح صافي محقق من الطلب رقم ' || o.order_number,
  5021000,
  5042000,
  o.created_by
FROM public.cash_sources cs,
     public.orders o
WHERE cs.name = 'القاصة الرئيسية'
AND o.order_number = 'ORD000002'
AND NOT EXISTS (
  SELECT 1 FROM public.cash_movements cm2 
  WHERE cm2.reference_id = o.id 
  AND cm2.reference_type = 'realized_profit'
);

-- تحديث الرصيد النهائي الصحيح
UPDATE public.cash_sources 
SET current_balance = 5000000 + 42000 - 29000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- عرض النتيجة النهائية المصححة
SELECT 
  'النتيجة النهائية' as البيان,
  5000000 as "رأس المال",
  42000 as "أرباح المبيعات", 
  29000 as "شراء منتجات",
  (5000000 + 42000 - 29000) as "الرصيد المفترض",
  cs.current_balance as "الرصيد الفعلي",
  (cs.current_balance - (5000000 + 42000 - 29000)) as "الفرق"
FROM public.cash_sources cs
WHERE cs.name = 'القاصة الرئيسية';