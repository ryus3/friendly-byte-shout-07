-- إصلاح البيانات المالية وضبط الرصيد النقدي
-- 1. تصحيح حركة نقدية خاطئة للطلب ORD000008 (98713588)
UPDATE public.cash_movements 
SET amount = 21000,
    balance_after = balance_before + 21000,
    description = 'إيراد من الطلب ORD000008 - 98713588'
WHERE id = '95bdc41d-ed83-4b17-a565-228173ffb691';

-- 2. حذف الحركة النقدية المبكرة للطلب ORD000010 (98783797) - لم يتم استلام الفاتورة بعد
DELETE FROM public.cash_movements 
WHERE id = 'ee4e3d4d-2d48-4720-829c-d85f89c1e190';

-- 3. تصحيح بيانات الأرباح للطلب ORD000005 (RYUS-299923)
UPDATE public.profits 
SET total_cost = 11000,
    profit_amount = total_revenue - 11000
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'ORD000005');

-- 4. تصحيح حالة الأرباح للطلب ORD000010 (98783797) - إعادة للحالة المعلقة
UPDATE public.profits 
SET status = 'pending',
    settled_at = NULL
WHERE order_id = (SELECT id FROM public.orders WHERE tracking_number = '98783797');

-- 5. إعادة حساب الأرصدة في جدول الحركات النقدية بناءً على التسلسل الصحيح
WITH ordered_movements AS (
  SELECT 
    id,
    amount,
    movement_type,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) as rn
  FROM public.cash_movements 
  WHERE cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية')
),
running_balance AS (
  SELECT 
    id,
    amount,
    movement_type,
    5000000 + SUM(CASE WHEN movement_type = 'in' THEN amount ELSE -amount END) 
      OVER (ORDER BY rn ROWS UNBOUNDED PRECEDING) as new_balance_after,
    5000000 + COALESCE(SUM(CASE WHEN movement_type = 'in' THEN amount ELSE -amount END) 
      OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) as new_balance_before
  FROM ordered_movements
)
UPDATE public.cash_movements 
SET balance_before = rb.new_balance_before,
    balance_after = rb.new_balance_after
FROM running_balance rb
WHERE public.cash_movements.id = rb.id;