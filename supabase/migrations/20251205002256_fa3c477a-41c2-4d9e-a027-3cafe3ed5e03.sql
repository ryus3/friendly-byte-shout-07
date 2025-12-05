-- =====================================================
-- إصلاح شامل لنظام فحص دقة المخزون
-- استخدام نفس منطق get_products_sold_stats للمبيعات
-- =====================================================

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS audit_inventory_accuracy();
DROP FUNCTION IF EXISTS fix_inventory_discrepancies();

-- =====================================================
-- 1. دالة الفحص الشامل المُحسّنة
-- =====================================================
CREATE OR REPLACE FUNCTION audit_inventory_accuracy()
RETURNS TABLE (
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_name text,
  size_value text,
  -- المخزون
  current_quantity integer,
  -- المحجوز
  current_reserved integer,
  calculated_reserved integer,
  reserved_diff integer,
  -- المباع
  current_sold integer,
  calculated_sold integer,
  sold_diff integer,
  -- المتاح
  current_available integer,
  calculated_available integer,
  -- النوع
  issue_type text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- حساب المحجوز الصحيح (فقط الطلبات النشطة غير المؤرشفة)
  calculated_reserved AS (
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(
        CASE 
          WHEN o.isarchived = true THEN 0
          WHEN o.delivery_status IN ('4', '17') THEN 0
          WHEN oi.item_status = 'delivered' OR oi.item_status = 'returned_in_stock' THEN 0
          WHEN o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'incoming' THEN 0
          ELSE oi.quantity
        END
      ), 0)::integer as reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_type != 'return' OR (o.order_type = 'return' AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing')
    GROUP BY oi.variant_id
  ),
  
  -- حساب المباع الصحيح (نفس منطق get_products_sold_stats بالضبط - يشمل المؤرشف!)
  calculated_sold AS (
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(
        CASE 
          -- طلب عادي مسلم (بما فيها المؤرشفة)
          WHEN (o.status IN ('completed', 'delivered') OR o.delivery_status = '4')
               AND COALESCE(o.order_type, 'normal') != 'partial_delivery'
               AND COALESCE(o.order_type, 'normal') != 'return'
               AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
          THEN oi.quantity
          -- تسليم جزئي - منتجات مسلمة فقط
          WHEN o.order_type = 'partial_delivery'
               AND oi.item_status = 'delivered'
               AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
          THEN oi.quantity
          ELSE 0
        END
      ), 0)::integer as sold_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    GROUP BY oi.variant_id
  ),
  
  -- دمج البيانات
  inventory_audit AS (
    SELECT 
      i.variant_id,
      i.product_id,
      i.quantity as current_qty,
      COALESCE(i.reserved_quantity, 0) as current_res,
      COALESCE(cr.reserved_qty, 0) as calc_res,
      COALESCE(i.sold_quantity, 0) as current_sld,
      COALESCE(cs.sold_qty, 0) as calc_sld
    FROM inventory i
    LEFT JOIN calculated_reserved cr ON cr.v_id = i.variant_id
    LEFT JOIN calculated_sold cs ON cs.v_id = i.variant_id
  )
  
  SELECT 
    ia.variant_id,
    ia.product_id,
    p.name::text as product_name,
    COALESCE(c.name, 'افتراضي')::text as color_name,
    COALESCE(pv.size, 'افتراضي')::text as size_value,
    -- المخزون
    ia.current_qty as current_quantity,
    -- المحجوز
    ia.current_res as current_reserved,
    ia.calc_res as calculated_reserved,
    (ia.current_res - ia.calc_res) as reserved_diff,
    -- المباع
    ia.current_sld as current_sold,
    ia.calc_sld as calculated_sold,
    (ia.current_sld - ia.calc_sld) as sold_diff,
    -- المتاح
    (ia.current_qty - ia.current_res) as current_available,
    (ia.current_qty - ia.calc_res) as calculated_available,
    -- تحديد نوع المشكلة
    CASE 
      WHEN ia.current_res < 0 THEN 'negative_reserved'
      WHEN ia.current_sld < 0 THEN 'negative_sold'
      WHEN (ia.current_qty - ia.current_res) < 0 THEN 'negative_available'
      WHEN ia.current_res != ia.calc_res AND ia.current_sld != ia.calc_sld THEN 'reserved_and_sold'
      WHEN ia.current_res != ia.calc_res THEN 'reserved_only'
      WHEN ia.current_sld != ia.calc_sld THEN 'sold_only'
      WHEN ia.current_qty < (ia.current_res + ia.current_sld) THEN 'consistency_error'
      ELSE NULL
    END as issue_type
  FROM inventory_audit ia
  JOIN products p ON p.id = ia.product_id
  LEFT JOIN product_variants pv ON pv.id = ia.variant_id
  LEFT JOIN colors c ON c.id = pv.color_id
  WHERE 
    -- فقط المنتجات التي بها مشاكل
    ia.current_res != ia.calc_res 
    OR ia.current_sld != ia.calc_sld
    OR ia.current_res < 0
    OR ia.current_sld < 0
    OR (ia.current_qty - ia.current_res) < 0
  ORDER BY p.name, c.name, pv.size;
END;
$$;

-- =====================================================
-- 2. دالة إصلاح الفروقات مع تسجيل في سجل العمليات
-- =====================================================
CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  fixed_reserved boolean,
  fixed_sold boolean,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_record RECORD;
  v_product_id uuid;
  v_product_name text;
  v_color_name text;
  v_size_value text;
BEGIN
  -- جلب جميع الفروقات
  FOR v_record IN 
    SELECT * FROM audit_inventory_accuracy()
  LOOP
    -- جلب معلومات المنتج
    SELECT p.name, c.name, pv.size, pv.product_id
    INTO v_product_name, v_color_name, v_size_value, v_product_id
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN colors c ON c.id = pv.color_id
    WHERE pv.id = v_record.variant_id;
    
    -- تسجيل في سجل العمليات قبل التصحيح
    IF v_record.reserved_diff != 0 OR v_record.sold_diff != 0 THEN
      INSERT INTO inventory_operations_log (
        variant_id,
        product_id,
        operation_type,
        quantity_change,
        quantity_before,
        quantity_after,
        reserved_before,
        reserved_after,
        sold_before,
        sold_after,
        source_type,
        notes,
        performed_at
      ) VALUES (
        v_record.variant_id,
        v_product_id,
        'audit_correction',
        0,
        v_record.current_quantity,
        v_record.current_quantity,
        v_record.current_reserved,
        v_record.calculated_reserved,
        v_record.current_sold,
        v_record.calculated_sold,
        'audit',
        'تصحيح تلقائي من فحص دقة المخزون - ' || 
        CASE 
          WHEN v_record.reserved_diff != 0 AND v_record.sold_diff != 0 
          THEN 'محجوز (' || v_record.current_reserved || '→' || v_record.calculated_reserved || ') + مباع (' || v_record.current_sold || '→' || v_record.calculated_sold || ')'
          WHEN v_record.reserved_diff != 0 
          THEN 'محجوز (' || v_record.current_reserved || '→' || v_record.calculated_reserved || ')'
          ELSE 'مباع (' || v_record.current_sold || '→' || v_record.calculated_sold || ')'
        END,
        now()
      );
    END IF;
    
    -- تحديث المخزون
    UPDATE inventory i
    SET 
      reserved_quantity = v_record.calculated_reserved,
      sold_quantity = v_record.calculated_sold,
      updated_at = now()
    WHERE i.variant_id = v_record.variant_id;
    
    -- إرجاع النتيجة
    variant_id := v_record.variant_id;
    product_name := v_product_name;
    fixed_reserved := v_record.reserved_diff != 0;
    fixed_sold := v_record.sold_diff != 0;
    old_reserved := v_record.current_reserved;
    new_reserved := v_record.calculated_reserved;
    old_sold := v_record.current_sold;
    new_sold := v_record.calculated_sold;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =====================================================
-- 3. دالة جلب إحصائيات المخزون الشاملة
-- =====================================================
CREATE OR REPLACE FUNCTION get_inventory_summary_stats()
RETURNS TABLE (
  total_products integer,
  total_quantity integer,
  total_reserved integer,
  total_available integer,
  total_sold integer,
  active_orders_count integer,
  delivered_orders_count integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(DISTINCT product_id)::integer FROM inventory),
    (SELECT COALESCE(SUM(quantity), 0)::integer FROM inventory),
    (SELECT COALESCE(SUM(reserved_quantity), 0)::integer FROM inventory),
    (SELECT COALESCE(SUM(quantity - COALESCE(reserved_quantity, 0)), 0)::integer FROM inventory),
    (SELECT COALESCE(SUM(sold_quantity), 0)::integer FROM inventory),
    (SELECT COUNT(*)::integer FROM orders WHERE isarchived = false AND delivery_status NOT IN ('4', '17')),
    (SELECT COUNT(*)::integer FROM orders WHERE delivery_status = '4');
END;
$$;

-- تعليقات توضيحية
COMMENT ON FUNCTION audit_inventory_accuracy() IS 'فحص شامل لدقة المخزون - يستخدم نفس منطق get_products_sold_stats للمبيعات';
COMMENT ON FUNCTION fix_inventory_discrepancies() IS 'تصحيح فروقات المخزون مع تسجيل التصحيحات في سجل العمليات';
COMMENT ON FUNCTION get_inventory_summary_stats() IS 'إحصائيات شاملة للمخزون (المجموع، المحجوز، المتاح، المباع)';