-- تصحيح دالة return_item_to_stock: إلغاء الحجز فقط بدون زيادة المخزون
CREATE OR REPLACE FUNCTION return_item_to_stock(
  p_variant_id UUID,
  p_quantity INTEGER,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- ✅ تقليل reserved_quantity فقط - لا تغيير في quantity
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    last_updated_by = p_user_id,
    updated_at = NOW()
  WHERE variant_id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج % غير موجود في المخزون', p_variant_id;
  END IF;
  
  RAISE NOTICE 'تم إلغاء حجز % وحدة من المتغير %', p_quantity, p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- تصحيح دالة return_stock_item: إلغاء الحجز فقط بدون زيادة المخزون
CREATE OR REPLACE FUNCTION return_stock_item(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- ✅ إلغاء الحجز فقط - لا زيادة في quantity
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = NOW()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  RAISE NOTICE 'تم إلغاء حجز % وحدة من المنتج %', p_quantity, p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء دالة جديدة release_reservation_only للوضوح
CREATE OR REPLACE FUNCTION release_reservation_only(
  p_variant_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = NOW()
  WHERE variant_id = p_variant_id;
  
  RAISE NOTICE 'تم تحرير حجز % وحدة من المتغير %', p_quantity, p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;