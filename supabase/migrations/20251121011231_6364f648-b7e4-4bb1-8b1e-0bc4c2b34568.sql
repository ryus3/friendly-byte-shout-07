
-- ============================================
-- المرحلة 1: إصلاح الدالة return_stock_item
-- ============================================
CREATE OR REPLACE FUNCTION public.return_stock_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- ✅ إرجاع المنتج للمخزون (بدون available_quantity)
  UPDATE inventory
  SET 
    quantity = quantity + p_quantity,
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  RAISE NOTICE 'تم إرجاع % من المنتج % للمخزون', p_quantity, p_variant_id;
END;
$function$;

-- ============================================
-- المرحلة 2: تصحيح item_status للطلبات المُرجعة
-- ============================================
UPDATE order_items oi
SET item_status = 'returned_in_stock'
FROM orders o
WHERE oi.order_id = o.id
  AND o.status = 'returned_in_stock'
  AND oi.item_status != 'returned_in_stock';

-- تصحيح الطلب 112168356 يدوياً
UPDATE order_items
SET item_status = 'returned_in_stock'
WHERE id = '6d5a7620-a92a-421c-9b36-3d549677928c';

-- ============================================
-- المرحلة 3: تصحيح مخزون إرجنتين XXL يدوياً
-- ============================================
UPDATE inventory
SET quantity = 4
WHERE variant_id = '1633269e-5280-447f-acda-c877eaed7796';

-- ============================================
-- التحقق النهائي
-- ============================================
SELECT 
  'إرجنتين XXL' AS product,
  i.quantity AS corrected_quantity,
  i.reserved_quantity,
  (i.quantity - i.reserved_quantity) AS available,
  p.name AS product_name,
  s.name AS size_name
FROM inventory i
JOIN product_variants pv ON pv.id = i.variant_id
JOIN products p ON p.id = pv.product_id
JOIN sizes s ON s.id = pv.size_id
WHERE i.variant_id = '1633269e-5280-447f-acda-c877eaed7796';

-- التحقق من item_status
SELECT 
  o.tracking_number,
  o.status AS order_status,
  oi.item_status AS item_corrected_status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.tracking_number = '112168356';
