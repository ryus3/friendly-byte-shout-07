-- تصحيح حساب الأرباح ليتطابق مع المطلوب
-- الطلب الواصل 55,000 - أجور التوصيل 5,000 - التكلفة 29,000 = 21,000 ربح صافي

-- تحديث حساب الأرباح للطلب ORD000002
UPDATE public.profits 
SET 
  total_cost = 29000,
  profit_amount = 21000,
  employee_profit = 21000,
  updated_at = now()
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'ORD000002');

-- تحديث رصيد القاصة الرئيسية ليعكس الربح الصحيح
UPDATE public.cash_sources 
SET current_balance = (
    SELECT 
        COALESCE((SELECT value::numeric FROM public.settings WHERE key = 'initial_capital'), 0) +
        COALESCE((SELECT SUM(employee_profit) FROM public.profits WHERE status = 'settled'), 0) +
        21000 -- الربح الصحيح للطلب الجديد
)
WHERE name = 'القاصة الرئيسية';

-- إضافة حركة نقد للربح المحقق
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
    'ربح محقق من الطلب ' || o.order_number,
    cs.current_balance - 21000,
    cs.current_balance,
    o.created_by
FROM public.cash_sources cs, public.orders o
WHERE cs.name = 'القاصة الرئيسية' 
AND o.order_number = 'ORD000002'
AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements cm 
    WHERE cm.reference_id = o.id AND cm.reference_type = 'realized_profit'
);