-- إصلاح دالة log_manual_inventory_changes لاستخدام الأعمدة الصحيحة
-- المشكلة: الدالة تستخدم quantity_before/quantity_after بينما الجدول يستخدم stock_before/stock_after

DROP FUNCTION IF EXISTS log_manual_inventory_changes() CASCADE;

CREATE OR REPLACE FUNCTION log_manual_inventory_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_op text;
  v_notes text;
  v_diff integer;
BEGIN
  -- تجاهل إذا لم يتغير شيء
  IF OLD.quantity = NEW.quantity AND OLD.reserved_quantity = NEW.reserved_quantity 
     AND OLD.sold_quantity = NEW.sold_quantity THEN
    RETURN NEW;
  END IF;
  
  v_diff := NEW.quantity - OLD.quantity;
  
  -- تحديد نوع العملية
  IF v_diff > 0 THEN
    v_op := 'stock_addition'; 
    v_notes := format('إضافة مخزون: +%s', v_diff);
  ELSIF v_diff < 0 THEN
    v_op := 'stock_reduction'; 
    v_notes := format('خصم مخزون: %s', v_diff);
  ELSIF NEW.reserved_quantity != OLD.reserved_quantity THEN
    v_op := 'reserved_adjustment'; 
    v_notes := format('تعديل محجوز: %s→%s', OLD.reserved_quantity, NEW.reserved_quantity);
  ELSIF NEW.sold_quantity != OLD.sold_quantity THEN
    v_op := 'sold_adjustment'; 
    v_notes := format('تعديل مباع: %s→%s', OLD.sold_quantity, NEW.sold_quantity);
  ELSE
    v_op := 'manual_adjustment'; 
    v_notes := 'تعديل يدوي';
  END IF;
  
  -- ✅ استخدام الأعمدة الصحيحة: stock_before/stock_after
  INSERT INTO product_tracking_log (
    variant_id, 
    operation_type,
    stock_before, 
    stock_after,
    reserved_before, 
    reserved_after,
    sold_before, 
    sold_after,
    source_type, 
    notes
  ) VALUES (
    NEW.variant_id, 
    v_op,
    OLD.quantity, 
    NEW.quantity,
    OLD.reserved_quantity, 
    NEW.reserved_quantity,
    OLD.sold_quantity, 
    NEW.sold_quantity,
    'manual', 
    v_notes
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إعادة إنشاء الترغر
DROP TRIGGER IF EXISTS trg_log_manual_inventory ON inventory;

CREATE TRIGGER trg_log_manual_inventory
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_manual_inventory_changes();