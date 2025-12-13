-- =============================================
-- إصلاح الـ Triggers المفقودة لتحديث المخزون تلقائياً
-- =============================================

-- 1. إنشاء/تحديث دالة تحديث المباع عند التسليم
CREATE OR REPLACE FUNCTION update_sold_quantity_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- فقط إذا تغير delivery_status إلى '4' (مُسلّم) ولم يُسجّل من قبل
  IF NEW.delivery_status = '4' 
     AND (OLD.delivery_status IS NULL OR OLD.delivery_status IS DISTINCT FROM '4')
     AND COALESCE(NEW.sold_recorded, false) = false
     AND NEW.order_type != 'return'
  THEN
    -- تحديث كل منتج في الطلب
    FOR v_item IN 
      SELECT oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.variant_id IS NOT NULL
        AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
        AND COALESCE(oi.item_status, '') != 'delivered' -- تجنب التكرار مع التسليم الجزئي
    LOOP
      -- تحديث المخزون: sold++, reserved--, quantity--
      UPDATE inventory
      SET 
        sold_quantity = COALESCE(sold_quantity, 0) + v_item.quantity,
        reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_item.quantity),
        quantity = GREATEST(0, COALESCE(quantity, 0) - v_item.quantity),
        updated_at = NOW()
      WHERE variant_id = v_item.variant_id;
      
      -- تسجيل في سجل العمليات
      INSERT INTO inventory_operations_log (
        variant_id, operation_type, quantity_change, 
        source_type, reference_id, notes, created_at
      ) VALUES (
        v_item.variant_id, 'sale', -v_item.quantity,
        'order_delivery', NEW.id::text, 
        'تسليم طلب - ' || COALESCE(NEW.tracking_number, NEW.order_number),
        NOW()
      );
    END LOOP;
    
    -- تعليم الطلب كـ "تم تسجيل المباع"
    NEW.sold_recorded := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. إنشاء/تحديث دالة إعادة حساب المحجوز
CREATE OR REPLACE FUNCTION recalculate_reserved_for_variant(p_variant_id uuid)
RETURNS void AS $$
DECLARE
  v_calculated_reserved integer;
BEGIN
  -- حساب المحجوز الصحيح من الطلبات النشطة
  SELECT COALESCE(SUM(oi.quantity), 0) INTO v_calculated_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.variant_id = p_variant_id
    AND o.delivery_status NOT IN ('4', '17')
    AND COALESCE(o.isarchived, false) = false
    AND o.order_type != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    AND COALESCE(oi.item_status, '') != 'delivered';
  
  -- تحديث المخزون
  UPDATE inventory
  SET 
    reserved_quantity = v_calculated_reserved,
    updated_at = NOW()
  WHERE variant_id = p_variant_id
    AND reserved_quantity IS DISTINCT FROM v_calculated_reserved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. دالة trigger لتحديث المحجوز عند تغيير الطلب
CREATE OR REPLACE FUNCTION update_reserved_on_order_change()
RETURNS TRIGGER AS $$
DECLARE
  v_variant_id uuid;
BEGIN
  -- جمع variant_ids المتأثرة
  IF TG_OP = 'DELETE' THEN
    -- عند الحذف، نحتاج تحديث المحجوز للمنتجات المحذوفة
    FOR v_variant_id IN 
      SELECT DISTINCT variant_id FROM order_items WHERE order_id = OLD.id AND variant_id IS NOT NULL
    LOOP
      PERFORM recalculate_reserved_for_variant(v_variant_id);
    END LOOP;
    RETURN OLD;
  END IF;
  
  -- عند INSERT أو UPDATE
  IF TG_OP = 'INSERT' OR (
    TG_OP = 'UPDATE' AND (
      OLD.delivery_status IS DISTINCT FROM NEW.delivery_status OR
      OLD.isarchived IS DISTINCT FROM NEW.isarchived OR
      OLD.order_type IS DISTINCT FROM NEW.order_type
    )
  ) THEN
    FOR v_variant_id IN 
      SELECT DISTINCT variant_id FROM order_items WHERE order_id = NEW.id AND variant_id IS NOT NULL
    LOOP
      PERFORM recalculate_reserved_for_variant(v_variant_id);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. حذف أي triggers قديمة متضاربة
DROP TRIGGER IF EXISTS trg_update_sold_on_delivery ON orders;
DROP TRIGGER IF EXISTS trg_update_reserved_on_order_change ON orders;
DROP TRIGGER IF EXISTS handle_order_status_change ON orders;
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;

-- 5. إنشاء الـ Triggers الجديدة
CREATE TRIGGER trg_update_sold_on_delivery
  BEFORE UPDATE OF delivery_status ON orders
  FOR EACH ROW
  WHEN (NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status IS DISTINCT FROM '4'))
  EXECUTE FUNCTION update_sold_quantity_on_delivery();

CREATE TRIGGER trg_update_reserved_on_order_change
  AFTER INSERT OR UPDATE OF delivery_status, isarchived, order_type OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_reserved_on_order_change();

-- 6. تأكيد وجود sold_recorded في orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'sold_recorded') THEN
    ALTER TABLE orders ADD COLUMN sold_recorded boolean DEFAULT false;
  END IF;
END $$;

-- 7. تحديث الطلبات المسلمة القديمة لتجنب إعادة التسجيل
UPDATE orders 
SET sold_recorded = true 
WHERE delivery_status = '4' 
  AND COALESCE(sold_recorded, false) = false;