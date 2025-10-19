-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS release_stock_item(uuid, uuid, integer);
DROP FUNCTION IF EXISTS return_stock_item(uuid, uuid, integer);

-- المرحلة 1: توسيع جدول order_items لدعم التسليم الجزئي
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quantity_delivered INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_returned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- إضافة index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(item_status);

-- المرحلة 2: إنشاء RPC Functions لإدارة المخزون

-- دالة تحرير منتج من المخزون
CREATE OR REPLACE FUNCTION release_stock_item(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- تحرير المخزون المحجوز
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  -- إضافة log للتتبع
  RAISE NOTICE 'تم تحرير % من المنتج % (variant: %)', p_quantity, p_product_id, p_variant_id;
END;
$$;

-- دالة إرجاع منتج للمخزون
CREATE OR REPLACE FUNCTION return_stock_item(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- إرجاع المنتج للمخزون
  UPDATE inventory
  SET 
    quantity = quantity + p_quantity,
    available_quantity = available_quantity + p_quantity,
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  -- إضافة log للتتبع
  RAISE NOTICE 'تم إرجاع % للمخزون - المنتج % (variant: %)', p_quantity, p_product_id, p_variant_id;
END;
$$;

-- تعليق على الحقول الجديدة
COMMENT ON COLUMN order_items.item_status IS 'حالة المنتج: pending, delivered, pending_return, returned, cancelled';
COMMENT ON COLUMN order_items.quantity_delivered IS 'الكمية المُسلّمة للزبون';
COMMENT ON COLUMN order_items.quantity_returned IS 'الكمية المُرتجعة للمخزون';
COMMENT ON COLUMN order_items.delivered_at IS 'تاريخ ووقت التسليم';
COMMENT ON COLUMN order_items.returned_at IS 'تاريخ ووقت الإرجاع';