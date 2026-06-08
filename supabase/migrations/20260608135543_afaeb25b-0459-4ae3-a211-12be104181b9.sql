-- توحيد دالة فحص دقة المخزون مع مصدر الحقيقة calc_reserved_for_variant
-- هذا يصلح فرق الـ "9" الوهمي الذي كان يظهر بسبب احتساب pending_return ضمن المحجوز
-- لا يلمس أي trigger ولا أي بيانات في جدول inventory

CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE(
  inv_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_reserved integer,
  calculated_reserved bigint,
  reserved_diff bigint,
  current_sold integer,
  calculated_sold bigint,
  sold_diff bigint,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH canonical_reserved AS (
    -- ✅ نفس منطق calc_reserved_for_variant بالضبط (مصدر الحقيقة الموحَّد)
    -- يحترم التسليم الجزئي: pending_return يبقى محجوزاً حتى 17
    SELECT
      oi.variant_id,
      SUM(oi.quantity)::bigint AS total_reserved
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE COALESCE(o.order_type, 'normal') <> 'return'
      AND o.status IN ('pending','shipped','delivery','returned','partial_delivery','cancelled')
      AND COALESCE(o.delivery_status::text, '') NOT IN ('4','17')
      AND COALESCE(oi.item_status, '') NOT IN ('delivered','returned_in_stock','returned')
      AND COALESCE(oi.item_direction, 'outgoing') <> 'incoming'
    GROUP BY oi.variant_id
  ),
  delivered_orders_sold AS (
    SELECT
      oi.variant_id,
      SUM(oi.quantity)::bigint AS total_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE (
      (COALESCE(o.delivery_status, '0') = '4' OR o.status IN ('completed','delivered'))
      OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    )
    AND COALESCE(o.order_type, 'normal') <> 'return'
    AND COALESCE(oi.item_direction, 'outgoing') <> 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT
    inv.variant_id AS inv_variant_id,
    p.name::text AS product_name,
    COALESCE(c.name, 'بدون لون')::text AS color_name,
    COALESCE(s.name, 'بدون قياس')::text AS size_value,
    COALESCE(inv.reserved_quantity, 0) AS current_reserved,
    COALESCE(cr.total_reserved, 0) AS calculated_reserved,
    (COALESCE(cr.total_reserved, 0) - COALESCE(inv.reserved_quantity, 0)) AS reserved_diff,
    COALESCE(inv.sold_quantity, 0) AS current_sold,
    COALESCE(dos.total_sold, 0) AS calculated_sold,
    (COALESCE(dos.total_sold, 0) - COALESCE(inv.sold_quantity, 0)) AS sold_diff,
    CASE
      WHEN COALESCE(cr.total_reserved, 0) <> COALESCE(inv.reserved_quantity, 0)
           AND COALESCE(dos.total_sold, 0) <> COALESCE(inv.sold_quantity, 0) THEN 'both'
      WHEN COALESCE(cr.total_reserved, 0) <> COALESCE(inv.reserved_quantity, 0) THEN 'reserved'
      WHEN COALESCE(dos.total_sold, 0) <> COALESCE(inv.sold_quantity, 0) THEN 'sold'
      ELSE 'ok'
    END AS issue_type
  FROM public.inventory inv
  JOIN public.product_variants pv ON pv.id = inv.variant_id
  JOIN public.products p ON p.id = pv.product_id
  LEFT JOIN public.colors c ON c.id = pv.color_id
  LEFT JOIN public.sizes s ON s.id = pv.size_id
  LEFT JOIN canonical_reserved cr ON cr.variant_id = inv.variant_id
  LEFT JOIN delivered_orders_sold dos ON dos.variant_id = inv.variant_id
  WHERE COALESCE(cr.total_reserved, 0) <> COALESCE(inv.reserved_quantity, 0)
     OR COALESCE(dos.total_sold, 0) <> COALESCE(inv.sold_quantity, 0);
END;
$function$;

-- دالة الإصلاح: تعتمد الآن على المصدر الموحَّد فقط
CREATE OR REPLACE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_variant_id uuid,
  fixed_product_name text,
  old_reserved integer,
  new_reserved bigint,
  old_sold integer,
  new_sold bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM public.audit_inventory_accuracy() WHERE issue_type <> 'ok'
  LOOP
    UPDATE public.inventory
    SET
      reserved_quantity = rec.calculated_reserved,
      sold_quantity = rec.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = rec.inv_variant_id;

    INSERT INTO public.inventory_operations_log (
      variant_id, operation_type, source_type, quantity_change, notes, created_at
    ) VALUES (
      rec.inv_variant_id, 'audit_correction', 'audit', 0,
      'توحيد فحص: المحجوز ' || rec.current_reserved || ' → ' || rec.calculated_reserved ||
      ' | المباع ' || rec.current_sold || ' → ' || rec.calculated_sold,
      NOW()
    );

    fixed_variant_id := rec.inv_variant_id;
    fixed_product_name := rec.product_name;
    old_reserved := rec.current_reserved;
    new_reserved := rec.calculated_reserved;
    old_sold := rec.current_sold;
    new_sold := rec.calculated_sold;
    RETURN NEXT;
  END LOOP;
END;
$function$;