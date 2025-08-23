-- ===== خطة الإصلاح الشاملة والموحدة =====
-- 1. إنشاء وظائف محسبة للمخزون المحجوز والمباع بدقة

-- حساب المخزون المحجوز لمتغير معين
CREATE OR REPLACE FUNCTION compute_reserved_for_variant(p_variant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  reserved_qty integer := 0;
BEGIN
  -- حساب الكمية المحجوزة من عناصر الطلبات في الحالات المحجوزة
  SELECT COALESCE(SUM(oi.quantity), 0) INTO reserved_qty
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = p_variant_id
  AND o.status IN ('pending', 'shipped', 'delivery')
  AND (o.status != 'returned' OR o.returned_in_stock != true);
  
  RETURN GREATEST(0, reserved_qty);
END;
$function$;

-- حساب المخزون المباع لمتغير معين (موحد بين المحلي والوسيط)
CREATE OR REPLACE FUNCTION compute_sold_for_variant(p_variant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  sold_qty integer := 0;
BEGIN
  -- حساب الكمية المباعة من عناصر الطلبات المكتملة والمسلمة
  -- إزالة شرط receipt_received لتوحيد النظام
  SELECT COALESCE(SUM(oi.quantity), 0) INTO sold_qty
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.variant_id = p_variant_id
  AND o.status IN ('completed', 'delivered');
  
  RETURN GREATEST(0, sold_qty);
END;
$function$;

-- فحص وإصلاح تناسق المخزون
CREATE OR REPLACE FUNCTION scan_and_fix_inventory_consistency()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  variant_info text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer,
  action_taken text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  inventory_record RECORD;
  calculated_reserved integer;
  calculated_sold integer;
  actions_text text;
BEGIN
  -- التكرار عبر جميع سجلات المخزون
  FOR inventory_record IN 
    SELECT 
      i.*,
      p.name as product_name,
      COALESCE(c.name || ' - ' || s.name, 'بدون تفاصيل') as variant_info
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variants pv ON i.variant_id = pv.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
  LOOP
    -- حساب القيم الصحيحة
    calculated_reserved := compute_reserved_for_variant(inventory_record.variant_id);
    calculated_sold := compute_sold_for_variant(inventory_record.variant_id);
    
    actions_text := '';
    
    -- تحديث المخزون المحجوز إذا كان مختلفاً
    IF inventory_record.reserved_quantity != calculated_reserved THEN
      actions_text := actions_text || 'تصحيح المحجوز من ' || inventory_record.reserved_quantity || ' إلى ' || calculated_reserved || '; ';
      
      UPDATE inventory 
      SET reserved_quantity = calculated_reserved,
          updated_at = now()
      WHERE id = inventory_record.id;
    END IF;
    
    -- تحديث المخزون المباع إذا كان مختلفاً
    IF COALESCE(inventory_record.sold_quantity, 0) != calculated_sold THEN
      actions_text := actions_text || 'تصحيح المباع من ' || COALESCE(inventory_record.sold_quantity, 0) || ' إلى ' || calculated_sold || '; ';
      
      UPDATE inventory 
      SET sold_quantity = calculated_sold,
          updated_at = now()
      WHERE id = inventory_record.id;
    END IF;
    
    -- إرجاع النتيجة إذا كان هناك تغيير
    IF actions_text != '' THEN
      variant_id := inventory_record.variant_id;
      product_name := inventory_record.product_name;
      variant_info := inventory_record.variant_info;
      old_reserved := inventory_record.reserved_quantity;
      new_reserved := calculated_reserved;
      old_sold := COALESCE(inventory_record.sold_quantity, 0);
      new_sold := calculated_sold;
      action_taken := TRIM(actions_text, '; ');
      
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$;

-- وظيفة منع الإشعارات المتكررة
CREATE OR REPLACE FUNCTION should_send_stock_notification(
  p_product_id uuid,
  p_variant_id uuid,
  p_notification_type text,
  p_stock_level integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  last_notification RECORD;
  cooldown_minutes integer := 60; -- فترة التهدئة بالدقائق
BEGIN
  -- البحث عن آخر إشعار لهذا المنتج/المتغير/النوع
  SELECT * INTO last_notification
  FROM stock_notification_history
  WHERE product_id = p_product_id
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
  AND notification_type = p_notification_type
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- إذا لم يوجد إشعار سابق، أرسل الإشعار
  IF last_notification.id IS NULL THEN
    INSERT INTO stock_notification_history (
      product_id, variant_id, notification_type, stock_level, created_at
    ) VALUES (
      p_product_id, p_variant_id, p_notification_type, p_stock_level, now()
    );
    RETURN true;
  END IF;
  
  -- إذا مر وقت كافٍ أو تغير مستوى المخزون، أرسل الإشعار
  IF (last_notification.created_at < now() - (cooldown_minutes || ' minutes')::interval) 
     OR (last_notification.stock_level != p_stock_level) THEN
    INSERT INTO stock_notification_history (
      product_id, variant_id, notification_type, stock_level, created_at
    ) VALUES (
      p_product_id, p_variant_id, p_notification_type, p_stock_level, now()
    );
    RETURN true;
  END IF;
  
  -- لا ترسل إشعار متكرر
  RETURN false;
END;
$function$;

-- إضافة عمود sold_quantity إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory' AND column_name = 'sold_quantity'
  ) THEN
    ALTER TABLE inventory ADD COLUMN sold_quantity integer DEFAULT 0;
  END IF;
END $$;

-- تحديث إحصائيات المنتجات المباعة (إزالة شرط receipt_received)
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
  WHERE o.status IN ('completed', 'delivered')
  -- إزالة شرط receipt_received لتوحيد النظام
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
    COALESCE(SUM(oi.quantity), 0) as total_products_sold,
    COALESCE(SUM(oi.total_price), 0) as total_revenue,
    COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, 0)), 0) as total_cogs,
    COALESCE(SUM(o.delivery_fee), 0) as total_delivery_fees
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  WHERE o.status IN ('completed', 'delivered');
  -- إزالة شرط receipt_received لتوحيد النظام
END;
$function$;

-- إضافة indexes للأداء
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_variant_status 
ON order_items(variant_id) 
WHERE variant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created 
ON orders(status, created_at) 
WHERE status IN ('pending', 'shipped', 'delivery', 'completed', 'delivered');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_notification_history_product_variant_type 
ON stock_notification_history(product_id, variant_id, notification_type, created_at);

-- تفعيل replica identity للجدول inventory
ALTER TABLE inventory REPLICA IDENTITY FULL;

-- إضافة جدول inventory إلى النشر المباشر
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  END IF;
END $$;