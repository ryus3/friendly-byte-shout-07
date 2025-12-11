
-- ============================================
-- المرحلة 2: تصحيح المباع مباشرة من الطلبات المُسلّمة
-- ============================================

-- تحديث sold_quantity بناءً على الحساب المباشر
UPDATE inventory inv
SET 
  sold_quantity = COALESCE(calc.total_sold, 0),
  updated_at = NOW()
FROM (
  SELECT 
    pv.id as variant_id,
    COALESCE(SUM(oi.quantity), 0) as total_sold
  FROM product_variants pv
  LEFT JOIN order_items oi ON oi.variant_id = pv.id
  LEFT JOIN orders o ON o.id = oi.order_id
  WHERE 
    -- طلبات مُسلّمة (delivery_status = 4) 
    (o.delivery_status = '4' OR o.status IN ('delivered', 'completed'))
    -- استثناء المرتجعات
    AND COALESCE(o.order_type, 'regular') != 'return'
    -- استثناء العناصر الواردة
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
  GROUP BY pv.id
) calc
WHERE inv.variant_id = calc.variant_id
AND inv.sold_quantity IS DISTINCT FROM COALESCE(calc.total_sold, 0);

-- تسجيل التصحيحات في السجل
INSERT INTO product_tracking_log (variant_id, operation_type, source_type, notes, created_at)
SELECT 
  i.variant_id,
  'sold_correction',
  'system',
  'تصحيح شامل للمباع - مطابقة مع الطلبات المُسلّمة',
  NOW()
FROM inventory i
WHERE i.updated_at > NOW() - INTERVAL '1 minute';

-- ============================================
-- المرحلة 3: تتبع المشتريات
-- ============================================

CREATE OR REPLACE FUNCTION log_purchase_to_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_inv record;
BEGIN
  FOR v_item IN SELECT * FROM purchase_items WHERE purchase_id = NEW.id
  LOOP
    SELECT quantity, reserved_quantity, sold_quantity INTO v_inv
    FROM inventory WHERE variant_id = v_item.variant_id;
    
    INSERT INTO product_tracking_log (
      variant_id, operation_type,
      quantity_before, quantity_after,
      reserved_before, reserved_after,
      sold_before, sold_after,
      source_type, source_id, reference_number, notes, performed_by
    ) VALUES (
      v_item.variant_id, 'purchase',
      COALESCE(v_inv.quantity, 0) - v_item.quantity, COALESCE(v_inv.quantity, 0),
      COALESCE(v_inv.reserved_quantity, 0), COALESCE(v_inv.reserved_quantity, 0),
      COALESCE(v_inv.sold_quantity, 0), COALESCE(v_inv.sold_quantity, 0),
      'purchase', NEW.id, NEW.invoice_number,
      format('شراء: %s وحدة', v_item.quantity), NEW.created_by
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_purchase ON purchases;
CREATE TRIGGER trg_log_purchase AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_purchase_to_tracking();

-- ============================================
-- المرحلة 4: تتبع التعديلات اليدوية
-- ============================================

CREATE OR REPLACE FUNCTION log_manual_inventory_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op text;
  v_notes text;
  v_diff integer;
BEGIN
  IF OLD.quantity = NEW.quantity AND OLD.reserved_quantity = NEW.reserved_quantity 
     AND OLD.sold_quantity = NEW.sold_quantity THEN
    RETURN NEW;
  END IF;
  
  v_diff := NEW.quantity - OLD.quantity;
  
  IF v_diff > 0 THEN
    v_op := 'stock_addition'; v_notes := format('إضافة: +%s', v_diff);
  ELSIF v_diff < 0 THEN
    v_op := 'stock_reduction'; v_notes := format('خصم: %s', v_diff);
  ELSIF NEW.reserved_quantity != OLD.reserved_quantity THEN
    v_op := 'reserved_adjustment'; v_notes := format('تعديل محجوز: %s→%s', OLD.reserved_quantity, NEW.reserved_quantity);
  ELSIF NEW.sold_quantity != OLD.sold_quantity THEN
    v_op := 'sold_adjustment'; v_notes := format('تعديل مباع: %s→%s', OLD.sold_quantity, NEW.sold_quantity);
  ELSE
    v_op := 'manual_adjustment'; v_notes := 'تعديل يدوي';
  END IF;
  
  INSERT INTO product_tracking_log (
    variant_id, operation_type,
    quantity_before, quantity_after,
    reserved_before, reserved_after,
    sold_before, sold_after,
    source_type, notes, performed_by
  ) VALUES (
    NEW.variant_id, v_op,
    OLD.quantity, NEW.quantity,
    OLD.reserved_quantity, NEW.reserved_quantity,
    OLD.sold_quantity, NEW.sold_quantity,
    'manual', v_notes, auth.uid()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_manual_inventory ON inventory;
CREATE TRIGGER trg_log_manual_inventory
  AFTER UPDATE OF quantity, reserved_quantity, sold_quantity ON inventory
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 2)
  EXECUTE FUNCTION log_manual_inventory_changes();

-- إضافة أعمدة مفقودة
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_tracking_log' AND column_name = 'reference_number') THEN
    ALTER TABLE product_tracking_log ADD COLUMN reference_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_tracking_log' AND column_name = 'sold_before') THEN
    ALTER TABLE product_tracking_log ADD COLUMN sold_before integer DEFAULT 0;
    ALTER TABLE product_tracking_log ADD COLUMN sold_after integer DEFAULT 0;
  END IF;
END $$;
