-- 1) إنشاء جدول سجل تتبع المنتجات
CREATE TABLE IF NOT EXISTS product_tracking_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  order_status TEXT,
  delivery_status TEXT,
  customer_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_tracking_variant ON product_tracking_log(variant_id);
CREATE INDEX IF NOT EXISTS idx_tracking_order ON product_tracking_log(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON product_tracking_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_operation ON product_tracking_log(operation_type);

-- تفعيل RLS
ALTER TABLE product_tracking_log ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
DROP POLICY IF EXISTS "Authenticated users can read tracking log" ON product_tracking_log;
CREATE POLICY "Authenticated users can read tracking log"
ON product_tracking_log FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert tracking log" ON product_tracking_log;
CREATE POLICY "System can insert tracking log"
ON product_tracking_log FOR INSERT
WITH CHECK (true);

-- 2) إنشاء دالة fix_inventory_discrepancies الجديدة
DROP FUNCTION IF EXISTS fix_inventory_discrepancies() CASCADE;

CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  old_reserved INT,
  new_reserved INT,
  old_sold INT,
  new_sold INT,
  fixed BOOLEAN
) AS $$
DECLARE
  v_record RECORD;
  v_calculated_reserved INT;
  v_calculated_sold INT;
BEGIN
  FOR v_record IN 
    SELECT 
      i.variant_id,
      p.name as product_name,
      i.reserved_quantity as old_reserved,
      i.sold_quantity as old_sold
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
  LOOP
    -- حساب المحجوز الصحيح من الطلبات النشطة
    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_calculated_reserved
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.variant_id = v_record.variant_id
      AND o.delivery_status NOT IN ('4', '17')
      AND o.isarchived IS NOT TRUE
      AND o.order_type IS DISTINCT FROM 'return'
      AND oi.item_direction IS DISTINCT FROM 'incoming'
      AND oi.item_status IS DISTINCT FROM 'delivered';
    
    -- حساب المباع الصحيح من الطلبات المسلمة
    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_calculated_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.variant_id = v_record.variant_id
      AND (
        o.delivery_status = '4'
        OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
      )
      AND o.order_type IS DISTINCT FROM 'return'
      AND oi.item_direction IS DISTINCT FROM 'incoming';
    
    -- تحديث إذا كان هناك اختلاف
    IF v_record.old_reserved != v_calculated_reserved 
       OR v_record.old_sold != v_calculated_sold 
    THEN
      UPDATE inventory
      SET 
        reserved_quantity = v_calculated_reserved,
        sold_quantity = v_calculated_sold
      WHERE inventory.variant_id = v_record.variant_id;
      
      -- تسجيل العملية
      INSERT INTO product_tracking_log (
        variant_id, order_id, operation_type, quantity,
        unit_price, order_status, delivery_status, customer_name
      ) VALUES (
        v_record.variant_id, NULL, 'audit_fix', 
        v_calculated_reserved - v_record.old_reserved,
        0, 'audit', 'audit', 'نظام التدقيق'
      );
      
      variant_id := v_record.variant_id;
      product_name := v_record.product_name;
      old_reserved := v_record.old_reserved;
      new_reserved := v_calculated_reserved;
      old_sold := v_record.old_sold;
      new_sold := v_calculated_sold;
      fixed := TRUE;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) تشغيل تصحيح البيانات
DO $$
DECLARE
  fix_result RECORD;
  fix_count INT := 0;
BEGIN
  FOR fix_result IN SELECT * FROM fix_inventory_discrepancies() LOOP
    fix_count := fix_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Total fixes applied: %', fix_count;
END $$;

-- 4) تصفير القيم السالبة
UPDATE inventory SET reserved_quantity = 0 WHERE reserved_quantity < 0;
UPDATE inventory SET sold_quantity = 0 WHERE sold_quantity < 0;

-- 5) إضافة CHECK constraints
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_reserved_non_negative;
ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_non_negative CHECK (reserved_quantity >= 0);

ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_sold_non_negative;
ALTER TABLE inventory ADD CONSTRAINT inventory_sold_non_negative CHECK (sold_quantity >= 0);