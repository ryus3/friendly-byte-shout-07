-- إصلاح وظيفة المخزون المحجوز - إزالة الإشارة للعمود غير الموجود
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
  AND o.status IN ('pending', 'shipped', 'delivery');
  
  RETURN GREATEST(0, reserved_qty);
END;
$function$;

-- إضافة indexes الأساسية للأداء
CREATE INDEX IF NOT EXISTS idx_order_items_variant_status 
ON order_items(variant_id) 
WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON orders(status, created_at) 
WHERE status IN ('pending', 'shipped', 'delivery', 'completed', 'delivered');

CREATE INDEX IF NOT EXISTS idx_stock_notification_history_product_variant_type 
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