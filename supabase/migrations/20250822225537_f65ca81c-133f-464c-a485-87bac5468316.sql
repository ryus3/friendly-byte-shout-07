
-- 1) إضافة العمود المفقود في جدول المتغيرات
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS sold_quantity integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.product_variants.sold_quantity IS 'Total units sold for this variant (maintained by triggers)';

-- 2) تهيئة القيم تاريخياً من الطلبات المكتملة والمستلمة فقط (إن وجدت)
WITH sold AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::integer AS sold_qty
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('completed','delivered')
    AND o.receipt_received = true
    AND oi.variant_id IS NOT NULL
  GROUP BY oi.variant_id
)
UPDATE public.product_variants pv
SET sold_quantity = COALESCE(s.sold_qty, 0)
FROM sold s
WHERE pv.id = s.variant_id;

-- ملاحظة: جدول inventory يحتوي بالفعل على sold_quantity (تم التحقق)،
-- والتريغر handle_order_status_change سيستمر بتحديث كلا العمودين بشكل تلقائي من الآن.
