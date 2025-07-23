-- تصفير النظام المالي وإعادة البناء من الصفر بالطريقة الصحيحة

-- 1. حذف جميع الحركات النقدية ما عدا رأس المال
DELETE FROM public.cash_movements 
WHERE cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية')
AND reference_type != 'initial_capital';

-- 2. إعادة تعيين رصيد القاصة الرئيسية لرأس المال فقط
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 3. إضافة أرباح المدير المحققة من الطلبات المستلمة
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
  (p.profit_amount - p.employee_profit),
  'in',
  'realized_profit',
  o.id,
  'ربح صافي محقق من الطلب رقم ' || o.order_number,
  5000000,
  5000000 + (p.profit_amount - p.employee_profit),
  o.created_by
FROM public.cash_sources cs,
     public.orders o
JOIN public.profits p ON o.id = p.order_id
WHERE cs.name = 'القاصة الرئيسية'
AND o.receipt_received = true
AND p.status = 'invoice_received';

-- 4. إضافة مصروف شراء المنتجات
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
  e.amount,
  'out',
  'expense',
  e.id,
  e.description,
  5042000,
  5042000 - e.amount,
  e.created_by
FROM public.cash_sources cs,
     public.expenses e
WHERE cs.name = 'القاصة الرئيسية'
AND e.status = 'approved'
AND e.receipt_number = '1';

-- 5. تحديث الرصيد النهائي للقاصة الرئيسية
UPDATE public.cash_sources 
SET current_balance = 5000000 + 42000 - 29000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 6. عرض النتيجة النهائية للتحقق
SELECT 
  name as "المصدر النقدي",
  initial_balance as "رأس المال", 
  current_balance as "الرصيد الحالي",
  (current_balance - initial_balance) as "صافي الحركة"
FROM public.cash_sources 
WHERE name = 'القاصة الرئيسية';