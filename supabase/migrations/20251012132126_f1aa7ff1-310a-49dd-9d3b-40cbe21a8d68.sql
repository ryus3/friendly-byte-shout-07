-- إصلاح function استعادة المخزون - استخدام جدول inventory الصحيح
CREATE OR REPLACE FUNCTION restore_purchase_inventory_before_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- استعادة الكميات من جدول inventory (وليس product_variants)
  UPDATE inventory inv
  SET 
    quantity = inv.quantity - pi.quantity,  -- طرح الكمية المشتراة لاستعادة الحالة السابقة
    updated_at = now()
  FROM purchase_items pi
  WHERE pi.purchase_id = OLD.id
    AND pi.variant_id = inv.variant_id
    AND pi.quantity > 0;

  RAISE NOTICE 'تم استعادة المخزون للفاتورة %', OLD.id;
  RETURN OLD;
END;
$$;