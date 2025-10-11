-- ✅ حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS public.return_items_to_inventory(uuid);

-- ✅ إعادة إنشاء الدالة بنوع الإرجاع الصحيح
CREATE OR REPLACE FUNCTION public.return_items_to_inventory(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- جلب عناصر الطلب الأصلي (إذا كان الإرجاع مرتبط بطلب أصلي)
  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.original_order_id
    WHERE o.id = p_order_id
    AND o.order_type = 'return'
  LOOP
    -- إضافة الكمية للمخزون
    UPDATE public.inventory
    SET 
      quantity = quantity + v_item.quantity,
      updated_at = now()
    WHERE product_id = v_item.product_id
    AND (variant_id = v_item.variant_id OR (variant_id IS NULL AND v_item.variant_id IS NULL));
    
    RAISE NOTICE 'تمت إضافة % من المنتج % (variant: %) للمخزون', 
      v_item.quantity, v_item.product_id, v_item.variant_id;
  END LOOP;
END;
$$;