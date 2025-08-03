-- إصلاح مشكلة حساب المنتجات المباعة
-- المشكلة: الـ function كانت تحسب منتجات من طلبات غير مكتملة بسبب GROUP BY خاطئ

CREATE OR REPLACE FUNCTION public.get_products_sold_stats()
 RETURNS TABLE(variant_id uuid, product_id uuid, sold_quantity bigint, orders_count bigint, total_revenue numeric, total_cost numeric, last_sold_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id as variant_id,
    pv.product_id,
    -- حساب الكمية المباعة فقط من الطلبات المكتملة والمستلمة
    COALESCE(SUM(
      CASE 
        WHEN o.status IN ('completed', 'delivered') AND o.receipt_received = true 
        THEN oi.quantity 
        ELSE 0 
      END
    ), 0)::BIGINT as sold_quantity,
    -- عدد الطلبات المكتملة والمستلمة فقط
    COUNT(DISTINCT 
      CASE 
        WHEN o.status IN ('completed', 'delivered') AND o.receipt_received = true 
        THEN o.id 
        ELSE NULL 
      END
    ) as orders_count,
    -- الإيرادات من الطلبات المكتملة والمستلمة فقط
    COALESCE(SUM(
      CASE 
        WHEN o.status IN ('completed', 'delivered') AND o.receipt_received = true 
        THEN oi.quantity * oi.unit_price 
        ELSE 0 
      END
    ), 0) as total_revenue,
    -- التكلفة من الطلبات المكتملة والمستلمة فقط  
    COALESCE(SUM(
      CASE 
        WHEN o.status IN ('completed', 'delivered') AND o.receipt_received = true 
        THEN oi.quantity * pv.cost_price 
        ELSE 0 
      END
    ), 0) as total_cost,
    -- آخر تاريخ بيع من الطلبات المكتملة والمستلمة فقط
    MAX(
      CASE 
        WHEN o.status IN ('completed', 'delivered') AND o.receipt_received = true 
        THEN o.created_at 
        ELSE NULL 
      END
    ) as last_sold_date
  FROM product_variants pv
  LEFT JOIN order_items oi ON pv.id = oi.variant_id
  LEFT JOIN orders o ON oi.order_id = o.id 
  GROUP BY pv.id, pv.product_id;
END;
$function$;