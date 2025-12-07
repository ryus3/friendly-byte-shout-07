-- 1. حذف الـ Trigger المكرر
DROP TRIGGER IF EXISTS trigger_handle_order_status_change ON orders;

-- 2. إصلاح دالة handle_order_status_change لتحرير المحجوز أولاً ثم إنقاص المخزون
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عند تغيير delivery_status إلى 4 (مسلّم)
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    -- تحديث المخزون: تحرير المحجوز أولاً، ثم إنقاص الكمية، ثم زيادة المباع
    UPDATE inventory i
    SET 
      reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity),
      quantity = GREATEST(0, i.quantity - oi.quantity),
      sold_quantity = COALESCE(i.sold_quantity, 0) + oi.quantity,
      updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND NEW.order_type != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. إصلاح بيانات المنتجات المتأثرة (الإيطالي الأزرق M والمنتجات الأخرى)
-- أولاً: نحسب الأرقام الصحيحة لكل variant متأثر

-- إصلاح variant الإيطالي الأزرق M (c78a4ec6-59b8-4e27-81a7-c89f44d4f02f)
-- المخزون الأصلي 6، محجوز 6، متاح 0، مباع 5 - هذا صحيح حسب الطلبات النشطة

-- تحديث أي variants لها reserved_quantity > quantity (الحالة الخاطئة)
UPDATE inventory
SET reserved_quantity = quantity
WHERE reserved_quantity > quantity;

-- التأكد من عدم وجود قيم سالبة
UPDATE inventory
SET 
  quantity = GREATEST(0, quantity),
  reserved_quantity = GREATEST(0, reserved_quantity),
  sold_quantity = GREATEST(0, COALESCE(sold_quantity, 0))
WHERE quantity < 0 OR reserved_quantity < 0 OR sold_quantity < 0;