-- ==========================================
-- 1️⃣ حذف وإعادة إنشاء دالة get_products_sold_stats
-- ==========================================
DROP FUNCTION IF EXISTS public.get_products_sold_stats();

CREATE FUNCTION public.get_products_sold_stats()
RETURNS TABLE(
  variant_id uuid,
  total_quantity_sold bigint,
  total_revenue numeric,
  orders_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    oi.variant_id,
    SUM(oi.quantity)::bigint as total_quantity_sold,
    SUM(oi.total_price)::numeric as total_revenue,
    COUNT(DISTINCT oi.order_id)::bigint as orders_count
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (
    -- الطلبات المكتملة أو المسلمة بالكامل
    o.status IN ('completed', 'delivered')
    OR o.delivery_status = '4'
    OR
    -- إصلاح: استخدام order_type بدلاً من status للتسليم الجزئي
    (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  AND o.status NOT IN ('returned_in_stock')
  AND oi.variant_id IS NOT NULL
  GROUP BY oi.variant_id;
END;
$function$;

-- ==========================================
-- 2️⃣ إصلاح دالة release_stock_item
-- ==========================================
CREATE OR REPLACE FUNCTION public.release_stock_item(
  p_product_id uuid, 
  p_variant_id uuid, 
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    quantity = GREATEST(0, quantity - p_quantity),
    sold_quantity = COALESCE(sold_quantity, 0) + p_quantity,
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
END;
$function$;

-- ==========================================
-- 3️⃣ تصحيح المنتج الأزرق L المتضرر
-- ==========================================
UPDATE inventory
SET 
  quantity = GREATEST(0, quantity - 1),
  sold_quantity = COALESCE(sold_quantity, 0) + 1,
  updated_at = now()
WHERE variant_id = '13ba6109-bdbc-4e5f-a086-2ad63f5ec770';