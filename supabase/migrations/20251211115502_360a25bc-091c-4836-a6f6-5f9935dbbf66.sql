-- 1. حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS audit_inventory_accuracy();

-- 2. إنشاء الدالة الجديدة مع JOIN sizes
CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  color_name text,
  size_name text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  calculated_reserved integer,
  calculated_sold integer,
  calculated_available integer,
  quantity_diff integer,
  reserved_diff integer,
  sold_diff integer,
  issue_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH delivered_stats AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) as total_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE (o.delivery_status = '4' OR o.status IN ('completed', 'delivered'))
      AND o.order_type != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  ),
  partial_delivered AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) as partial_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type = 'partial_delivery'
      AND oi.item_status = 'delivered'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  ),
  reserved_stats AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) as total_reserved
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND NOT COALESCE(o.isarchived, false)
      AND NOT (o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming')
      AND COALESCE(oi.item_status, 'pending') NOT IN ('delivered', 'returned', 'cancelled')
    GROUP BY oi.variant_id
  )
  SELECT 
    i.variant_id,
    p.name as product_name,
    c.name as color_name,
    s.name as size_name,
    i.quantity as current_quantity,
    i.reserved_quantity as current_reserved,
    COALESCE(i.sold_quantity, 0) as current_sold,
    COALESCE(rs.total_reserved, 0)::integer as calculated_reserved,
    (COALESCE(ds.total_sold, 0) + COALESCE(pd.partial_sold, 0))::integer as calculated_sold,
    (i.quantity - COALESCE(rs.total_reserved, 0))::integer as calculated_available,
    0 as quantity_diff,
    (i.reserved_quantity - COALESCE(rs.total_reserved, 0))::integer as reserved_diff,
    (COALESCE(i.sold_quantity, 0) - (COALESCE(ds.total_sold, 0) + COALESCE(pd.partial_sold, 0)))::integer as sold_diff,
    CASE 
      WHEN i.reserved_quantity != COALESCE(rs.total_reserved, 0) AND COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pd.partial_sold, 0)) THEN 'reserved_and_sold'
      WHEN i.reserved_quantity != COALESCE(rs.total_reserved, 0) THEN 'reserved_mismatch'
      WHEN COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pd.partial_sold, 0)) THEN 'sold_mismatch'
      WHEN i.quantity - i.reserved_quantity < 0 THEN 'negative_available'
      ELSE 'ok'
    END as issue_type
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  LEFT JOIN delivered_stats ds ON ds.variant_id = i.variant_id
  LEFT JOIN partial_delivered pd ON pd.variant_id = i.variant_id
  LEFT JOIN reserved_stats rs ON rs.variant_id = i.variant_id
  WHERE i.reserved_quantity != COALESCE(rs.total_reserved, 0)
     OR COALESCE(i.sold_quantity, 0) != (COALESCE(ds.total_sold, 0) + COALESCE(pd.partial_sold, 0))
     OR i.quantity - i.reserved_quantity < 0;
END;
$$;

-- 3. إضافة عمود sold_recorded لمنع تكرار تسجيل المبيعات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sold_recorded boolean DEFAULT false;

-- 4. تحديث الطلبات المُسلّمة الحالية لتكون sold_recorded = true
UPDATE orders 
SET sold_recorded = true 
WHERE (delivery_status = '4' OR status IN ('completed', 'delivered'))
  AND sold_recorded IS NOT TRUE;

-- 5. تعديل trigger تسجيل المبيعات ليتحقق من sold_recorded
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
BEGIN
  -- فقط عند التغيير إلى حالة التسليم (4) ولم يُسجّل مسبقاً
  IF NEW.delivery_status = '4' AND OLD.delivery_status != '4' AND NOT COALESCE(NEW.sold_recorded, false) THEN
    -- تحديث sold_quantity للمنتجات
    FOR item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
        AND NEW.order_type != 'return'
    LOOP
      UPDATE inventory 
      SET 
        sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - item.quantity)
      WHERE variant_id = item.variant_id;
    END LOOP;
    
    -- تحديد أن المبيعات سُجّلت
    NEW.sold_recorded := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. تصحيح بيانات منتج ترانش طويل
UPDATE inventory SET quantity = 47, sold_quantity = 3
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN colors c ON c.id = pv.color_id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'نيلي'
);

UPDATE inventory SET quantity = 43
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN colors c ON c.id = pv.color_id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'أسود'
);

UPDATE inventory SET quantity = 42, sold_quantity = 8
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN colors c ON c.id = pv.color_id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'بيجي'
);

UPDATE inventory SET quantity = 44, sold_quantity = 6
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN colors c ON c.id = pv.color_id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'جوزي'
);

UPDATE inventory SET quantity = 48
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN colors c ON c.id = pv.color_id
  WHERE p.name LIKE '%ترانش طويل%' AND c.name = 'رصاصي'
);