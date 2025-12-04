
-- تحديث دالة الفحص الشامل للمخزون
DROP FUNCTION IF EXISTS audit_inventory_accuracy();
CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  calculated_reserved integer,
  reserved_diff integer,
  current_sold integer,
  calculated_sold integer,
  sold_diff integer,
  available integer,
  issue_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH calculated_values AS (
    SELECT 
      i.variant_id,
      -- حساب المحجوز: الطلبات النشطة (ليست مُسلّمة أو راجعة للمخزون)
      COALESCE(SUM(
        CASE 
          WHEN o.order_type = 'return' THEN 0
          WHEN o.delivery_status IN ('4', '17') THEN 0
          WHEN oi.item_status = 'delivered' THEN 0
          WHEN oi.item_direction = 'incoming' THEN 0
          ELSE oi.quantity 
        END
      ), 0)::integer AS calc_reserved,
      -- حساب المباع: المنتجات المُسلّمة فعلياً
      COALESCE(SUM(
        CASE 
          WHEN o.delivery_status = '4' AND oi.item_status != 'returned' AND o.order_type != 'return' THEN oi.quantity
          WHEN oi.item_status = 'delivered' THEN oi.quantity
          ELSE 0 
        END
      ), 0)::integer AS calc_sold
    FROM inventory i
    LEFT JOIN order_items oi ON oi.variant_id = i.variant_id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.isarchived = false
    GROUP BY i.variant_id
  ),
  inventory_check AS (
    SELECT 
      i.variant_id,
      p.name AS product_name,
      c.name AS color_name,
      s.value AS size_value,
      i.quantity AS current_quantity,
      i.reserved_quantity AS current_reserved,
      COALESCE(cv.calc_reserved, 0) AS calculated_reserved,
      (i.reserved_quantity - COALESCE(cv.calc_reserved, 0)) AS reserved_diff,
      i.sold_quantity AS current_sold,
      COALESCE(cv.calc_sold, 0) AS calculated_sold,
      (i.sold_quantity - COALESCE(cv.calc_sold, 0)) AS sold_diff,
      (i.quantity - i.reserved_quantity) AS available,
      CASE
        WHEN i.reserved_quantity != COALESCE(cv.calc_reserved, 0) AND i.sold_quantity != COALESCE(cv.calc_sold, 0) THEN 'reserved_and_sold'
        WHEN i.reserved_quantity != COALESCE(cv.calc_reserved, 0) THEN 'reserved_only'
        WHEN i.sold_quantity != COALESCE(cv.calc_sold, 0) THEN 'sold_only'
        WHEN (i.quantity - i.reserved_quantity) < 0 THEN 'negative_available'
        WHEN i.reserved_quantity < 0 THEN 'negative_reserved'
        WHEN i.sold_quantity < 0 THEN 'negative_sold'
        ELSE NULL
      END AS issue_type
    FROM inventory i
    JOIN product_variants pv ON pv.id = i.variant_id
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN colors c ON c.id = pv.color_id
    LEFT JOIN sizes s ON s.id = pv.size_id
    LEFT JOIN calculated_values cv ON cv.variant_id = i.variant_id
  )
  SELECT 
    ic.variant_id,
    ic.product_name,
    ic.color_name,
    ic.size_value,
    ic.current_quantity,
    ic.current_reserved,
    ic.calculated_reserved,
    ic.reserved_diff,
    ic.current_sold,
    ic.calculated_sold,
    ic.sold_diff,
    ic.available,
    ic.issue_type
  FROM inventory_check ic
  WHERE ic.issue_type IS NOT NULL
  ORDER BY 
    CASE ic.issue_type 
      WHEN 'negative_available' THEN 1
      WHEN 'negative_reserved' THEN 2
      WHEN 'negative_sold' THEN 3
      WHEN 'reserved_and_sold' THEN 4
      WHEN 'reserved_only' THEN 5
      WHEN 'sold_only' THEN 6
    END,
    ic.product_name;
END;
$$;

-- تحديث دالة الإصلاح التلقائي
DROP FUNCTION IF EXISTS fix_inventory_discrepancies();
CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer,
  fix_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH calculated_values AS (
    SELECT 
      i.variant_id,
      COALESCE(SUM(
        CASE 
          WHEN o.order_type = 'return' THEN 0
          WHEN o.delivery_status IN ('4', '17') THEN 0
          WHEN oi.item_status = 'delivered' THEN 0
          WHEN oi.item_direction = 'incoming' THEN 0
          ELSE oi.quantity 
        END
      ), 0)::integer AS calc_reserved,
      COALESCE(SUM(
        CASE 
          WHEN o.delivery_status = '4' AND oi.item_status != 'returned' AND o.order_type != 'return' THEN oi.quantity
          WHEN oi.item_status = 'delivered' THEN oi.quantity
          ELSE 0 
        END
      ), 0)::integer AS calc_sold
    FROM inventory i
    LEFT JOIN order_items oi ON oi.variant_id = i.variant_id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.isarchived = false
    GROUP BY i.variant_id
  ),
  updates AS (
    UPDATE inventory i
    SET 
      reserved_quantity = GREATEST(0, COALESCE(cv.calc_reserved, 0)),
      sold_quantity = GREATEST(0, COALESCE(cv.calc_sold, 0)),
      updated_at = NOW()
    FROM calculated_values cv
    JOIN product_variants pv ON pv.id = cv.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE i.variant_id = cv.variant_id
      AND (i.reserved_quantity != cv.calc_reserved OR i.sold_quantity != cv.calc_sold)
    RETURNING 
      i.variant_id,
      p.name AS product_name,
      i.reserved_quantity AS old_reserved,
      cv.calc_reserved AS new_reserved,
      i.sold_quantity AS old_sold,
      cv.calc_sold AS new_sold,
      CASE
        WHEN i.reserved_quantity != cv.calc_reserved AND i.sold_quantity != cv.calc_sold THEN 'both_fixed'
        WHEN i.reserved_quantity != cv.calc_reserved THEN 'reserved_fixed'
        ELSE 'sold_fixed'
      END AS fix_type
  )
  SELECT * FROM updates;
END;
$$;
