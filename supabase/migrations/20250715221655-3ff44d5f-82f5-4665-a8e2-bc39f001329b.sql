-- إنشاء دالة لإنهاء المخزون (خصم فعلي + إلغاء حجز)
CREATE OR REPLACE FUNCTION public.finalize_stock_item(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory 
  SET 
    quantity = quantity - p_quantity,
    reserved_quantity = reserved_quantity - p_quantity,
    updated_at = now()
  WHERE product_id = p_product_id AND variant_id = p_variant_id;
  
  -- التحقق من أن التحديث تم بنجاح
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على المنتج في المخزون';
  END IF;
END;
$$;

-- إنشاء دالة لإلغاء حجز المخزون فقط
CREATE OR REPLACE FUNCTION public.release_stock_item(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory 
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id AND variant_id = p_variant_id;
  
  -- التحقق من أن التحديث تم بنجاح
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على المنتج في المخزون';
  END IF;
END;
$$;