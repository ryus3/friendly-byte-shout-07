-- ===================================================================
-- إصلاح شامل لنظام التسليم الجزئي: المبيعات + المحجوز + الفواتير
-- ===================================================================

-- ============================================
-- 1️⃣ تحديث دوال حساب المبيعات لتشمل partial_delivery
-- ============================================

CREATE OR REPLACE FUNCTION get_products_sold_stats()
RETURNS TABLE(
  variant_id uuid,
  sold_quantity bigint,
  orders_count bigint,
  total_revenue numeric,
  total_cost numeric,
  last_sold_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as sold_quantity,
    COUNT(DISTINCT oi.order_id) as orders_count,
    SUM(oi.total_price) as total_revenue,
    SUM(oi.quantity * COALESCE(pv.cost_price, 0)) as total_cost,
    MAX(o.created_at) as last_sold_date
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  WHERE (
    -- ✅ الطلبات المكتملة أو المسلمة بالكامل
    o.status IN ('completed', 'delivered')
    OR
    -- ✅ الطلبات ذات التسليم الجزئي - فقط العناصر المباعة
    (o.status = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  -- ⛔ استبعاد الطلبات المرتجعة للمخزون (الإرجاع الكامل)
  AND o.status NOT IN ('returned_in_stock')
  GROUP BY oi.variant_id;
END;
$function$;

-- تحديث الإحصائيات العامة للمبيعات
CREATE OR REPLACE FUNCTION get_sales_summary_stats()
RETURNS TABLE(
  total_orders bigint,
  total_products_sold bigint,
  total_revenue numeric,
  total_cogs numeric,
  total_delivery_fees numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT o.id) as total_orders,
    SUM(oi.quantity) as total_products_sold,
    SUM(oi.total_price) as total_revenue,
    SUM(oi.quantity * COALESCE(pv.cost_price, 0)) as total_cogs,
    SUM(COALESCE(o.delivery_fee, 0)) as total_delivery_fees
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  WHERE (
    -- ✅ الطلبات المكتملة أو المسلمة
    o.status IN ('completed', 'delivered')
    OR
    -- ✅ التسليم الجزئي - فقط العناصر المباعة
    (o.status = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  AND o.status NOT IN ('returned_in_stock');
END;
$function$;

-- ============================================
-- 2️⃣ إنشاء Trigger لتحديث المخزون تلقائياً عند التسليم الجزئي
-- ============================================

CREATE OR REPLACE FUNCTION auto_update_inventory_on_partial_delivery()
RETURNS TRIGGER AS $$
DECLARE
  parent_order_status TEXT;
BEGIN
  -- فقط عند تحديث item_status إلى 'delivered' في طلب partial_delivery
  IF (TG_OP = 'UPDATE' AND NEW.item_status = 'delivered' AND 
      (OLD.item_status IS NULL OR OLD.item_status != 'delivered')) THEN
    
    -- جلب حالة الطلب الأب
    SELECT status INTO parent_order_status 
    FROM orders 
    WHERE id = NEW.order_id;
    
    -- فقط لطلبات التسليم الجزئي
    IF parent_order_status = 'partial_delivery' THEN
      -- تحديث المخزون: تحرير المحجوز + زيادة المباع
      UPDATE inventory
      SET 
        reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - NEW.quantity),
        sold_quantity = COALESCE(sold_quantity, 0) + NEW.quantity,
        updated_at = now()
      WHERE variant_id = NEW.variant_id;
      
      RAISE LOG '✅ محجوز→مباع: المنتج % (كمية: %)', NEW.variant_id, NEW.quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الـ trigger
DROP TRIGGER IF EXISTS trigger_auto_partial_delivery_inventory ON order_items;
CREATE TRIGGER trigger_auto_partial_delivery_inventory
  AFTER UPDATE OF item_status ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_inventory_on_partial_delivery();

-- ============================================
-- 3️⃣ تصحيح بيانات الطلب 112552848 فوراً
-- ============================================

DO $$
DECLARE
  italian_blue_xl_id UUID := 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';
  argentinian_s_id UUID := '7484a597-902d-42b7-b6bc-b0e2f5fab0fa';
  italian_white_xxl_id UUID := 'fd18355e-3596-41d1-8620-8d5990ba362d';
  order_112552848 UUID;
BEGIN
  -- جلب order_id
  SELECT id INTO order_112552848 
  FROM orders 
  WHERE tracking_number = '112552848';
  
  IF order_112552848 IS NOT NULL THEN
    -- ✅ إيطالي أزرق XL: يجب أن يبقى محجوز (pending_return)
    UPDATE inventory
    SET reserved_quantity = reserved_quantity + 1
    WHERE variant_id = italian_blue_xl_id
      AND reserved_quantity = 0;
    
    -- ✅ أرجنتين شتوي S + إيطالي أبيض XXL: تحرير المحجوز (مباع فعلاً)
    UPDATE inventory
    SET reserved_quantity = GREATEST(0, reserved_quantity - 1)
    WHERE variant_id IN (argentinian_s_id, italian_white_xxl_id)
      AND EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = order_112552848
          AND oi.variant_id = inventory.variant_id
          AND oi.item_status = 'delivered'
      );
    
    RAISE NOTICE '✅ تم تصحيح الطلب 112552848';
  ELSE
    RAISE WARNING '⚠️ الطلب 112552848 غير موجود';
  END IF;
END $$;

-- ============================================
-- 4️⃣ إعادة حساب شاملة للمبيعات والمحجوز
-- ============================================

-- تصفير sold_quantity أولاً ثم إعادة الحساب من order_items
UPDATE inventory
SET sold_quantity = 0;

-- حساب المبيعات الفعلية من جميع الطلبات
WITH actual_sales AS (
  SELECT 
    oi.variant_id,
    SUM(oi.quantity) as total_sold
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE (
    -- الطلبات المكتملة والمسلمة
    o.status IN ('completed', 'delivered')
    OR
    -- التسليم الجزئي - فقط العناصر delivered
    (o.status = 'partial_delivery' AND oi.item_status = 'delivered')
  )
  AND o.status NOT IN ('returned_in_stock')
  GROUP BY oi.variant_id
)
UPDATE inventory i
SET sold_quantity = COALESCE(s.total_sold, 0)
FROM actual_sales s
WHERE i.variant_id = s.variant_id;

-- التحقق من النتائج المتوقعة
DO $$
DECLARE
  arg_s_sold INTEGER;
  arg_s_reserved INTEGER;
  ita_white_sold INTEGER;
  ita_blue_reserved INTEGER;
BEGIN
  -- أرجنتين شتوي سمول
  SELECT COALESCE(sold_quantity, 0), COALESCE(reserved_quantity, 0)
  INTO arg_s_sold, arg_s_reserved
  FROM inventory
  WHERE variant_id = '7484a597-902d-42b7-b6bc-b0e2f5fab0fa';
  
  -- إيطالي أبيض XXL
  SELECT COALESCE(sold_quantity, 0)
  INTO ita_white_sold
  FROM inventory
  WHERE variant_id = 'fd18355e-3596-41d1-8620-8d5990ba362d';
  
  -- إيطالي أزرق XL
  SELECT COALESCE(reserved_quantity, 0)
  INTO ita_blue_reserved
  FROM inventory
  WHERE variant_id = 'e80a450f-1d4f-42ad-a6ce-0bd054ddeb72';
  
  RAISE NOTICE '📊 النتائج بعد التصحيح:';
  RAISE NOTICE '  - أرجنتين سمول: مباع=% (المتوقع: 13)، محجوز=% (المتوقع: 4)', arg_s_sold, arg_s_reserved;
  RAISE NOTICE '  - إيطالي أبيض XXL: مباع=% (يجب أن يشمل القطعة من 112552848)', ita_white_sold;
  RAISE NOTICE '  - إيطالي أزرق XL: محجوز=% (المتوقع: 1)', ita_blue_reserved;
END $$;