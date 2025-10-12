-- إصلاح function استعادة المخزون - تصحيح اسم العمود
CREATE OR REPLACE FUNCTION restore_purchase_inventory_before_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- استعادة الكميات للمخزون
  UPDATE product_variants pv
  SET 
    quantity = pv.quantity - pi.quantity,
    updated_at = now()
  FROM purchase_items pi
  WHERE pi.purchase_id = OLD.id
    AND pi.variant_id = pv.id
    AND pi.quantity > 0;

  RAISE NOTICE 'تم استعادة المخزون للفاتورة %', OLD.id;
  RETURN OLD;
END;
$$;