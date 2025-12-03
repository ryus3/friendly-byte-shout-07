-- =====================================================
-- تصحيح sold_quantity من الطلبات الفعلية المُسلّمة
-- =====================================================

-- 1. إعادة حساب sold_quantity لجميع المنتجات
WITH correct_sold AS (
  SELECT 
    oi.variant_id,
    COALESCE(SUM(oi.quantity), 0)::integer as calc_sold
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (
    -- الطلبات المُسلّمة بالكامل
    o.delivery_status = '4'
    -- أو المنتجات المُسلّمة في التسليم الجزئي
    OR oi.item_status = 'delivered'
  )
  -- استثناء المنتجات الواردة (الاستبدال/الإرجاع)
  AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  -- استثناء الطلبات المؤرشفة
  AND o.isarchived IS NOT TRUE
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET sold_quantity = COALESCE(cs.calc_sold, 0)
FROM correct_sold cs
WHERE i.variant_id = cs.variant_id;

-- 2. تصفير sold_quantity للمنتجات التي ليس لها مبيعات
UPDATE inventory i
SET sold_quantity = 0
WHERE NOT EXISTS (
  SELECT 1 FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = i.variant_id
  AND (o.delivery_status = '4' OR oi.item_status = 'delivered')
  AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  AND o.isarchived IS NOT TRUE
)
AND i.sold_quantity > 0;

-- =====================================================
-- دالة الفحص الدوري للمخزون
-- =====================================================
CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_reserved integer,
  calculated_reserved integer,
  reserved_diff integer,
  current_sold integer,
  calculated_sold integer,
  sold_diff integer,
  has_discrepancy boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- حساب المحجوز الصحيح من الطلبات النشطة
  calc_reserved AS (
    SELECT 
      oi.variant_id as vid,
      COALESCE(SUM(oi.quantity), 0)::integer as reserved
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_status NOT IN ('4', '17')
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND NOT (o.order_type = 'return' AND oi.item_direction = 'incoming')
    GROUP BY oi.variant_id
  ),
  -- حساب المباع الصحيح من الطلبات المُسلّمة
  calc_sold AS (
    SELECT 
      oi.variant_id as vid,
      COALESCE(SUM(oi.quantity), 0)::integer as sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE (o.delivery_status = '4' OR oi.item_status = 'delivered')
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND o.isarchived IS NOT TRUE
    GROUP BY oi.variant_id
  )
  SELECT 
    i.variant_id,
    p.name as product_name,
    c.name as color_name,
    pv.size as size_value,
    i.reserved_quantity as current_reserved,
    COALESCE(cr.reserved, 0) as calculated_reserved,
    (i.reserved_quantity - COALESCE(cr.reserved, 0)) as reserved_diff,
    i.sold_quantity as current_sold,
    COALESCE(cs.sold, 0) as calculated_sold,
    (i.sold_quantity - COALESCE(cs.sold, 0)) as sold_diff,
    (i.reserved_quantity != COALESCE(cr.reserved, 0) OR i.sold_quantity != COALESCE(cs.sold, 0)) as has_discrepancy
  FROM inventory i
  JOIN product_variants pv ON i.variant_id = pv.id
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN calc_reserved cr ON i.variant_id = cr.vid
  LEFT JOIN calc_sold cs ON i.variant_id = cs.vid
  WHERE i.reserved_quantity != COALESCE(cr.reserved, 0) 
     OR i.sold_quantity != COALESCE(cs.sold, 0)
  ORDER BY p.name, c.name, pv.size;
END;
$$;

-- =====================================================
-- دالة إصلاح تلقائي للفروقات
-- =====================================================
CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE (
  fixed_variant_id uuid,
  product_name text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  calc_reserved AS (
    SELECT 
      oi.variant_id as vid,
      COALESCE(SUM(oi.quantity), 0)::integer as reserved
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_status NOT IN ('4', '17')
    AND o.isarchived IS NOT TRUE
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND NOT (o.order_type = 'return' AND oi.item_direction = 'incoming')
    GROUP BY oi.variant_id
  ),
  calc_sold AS (
    SELECT 
      oi.variant_id as vid,
      COALESCE(SUM(oi.quantity), 0)::integer as sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE (o.delivery_status = '4' OR oi.item_status = 'delivered')
    AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
    AND o.isarchived IS NOT TRUE
    GROUP BY oi.variant_id
  ),
  updates AS (
    UPDATE inventory i
    SET 
      reserved_quantity = COALESCE(cr.reserved, 0),
      sold_quantity = COALESCE(cs.sold, 0)
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN calc_reserved cr ON i.variant_id = cr.vid
    LEFT JOIN calc_sold cs ON i.variant_id = cs.vid
    WHERE i.variant_id = pv.id
    AND (i.reserved_quantity != COALESCE(cr.reserved, 0) OR i.sold_quantity != COALESCE(cs.sold, 0))
    RETURNING 
      i.variant_id as fvid,
      p.name as pname,
      i.reserved_quantity as old_res,
      COALESCE(cr.reserved, 0) as new_res,
      i.sold_quantity as old_sld,
      COALESCE(cs.sold, 0) as new_sld
  )
  SELECT fvid, pname, old_res, new_res, old_sld, new_sld FROM updates;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION audit_inventory_accuracy() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_inventory_discrepancies() TO authenticated;