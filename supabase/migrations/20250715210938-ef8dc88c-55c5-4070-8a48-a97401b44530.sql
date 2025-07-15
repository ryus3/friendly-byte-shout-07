-- إنشاء دالة حجز/إلغاء حجز المخزون
CREATE OR REPLACE FUNCTION public.update_reserved_stock(
  p_product_id UUID,
  p_sku TEXT DEFAULT NULL,
  p_quantity_change INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_quantity INTEGER;
  current_reserved INTEGER;
  new_reserved INTEGER;
BEGIN
  -- العثور على المخزون المناسب
  IF p_sku IS NOT NULL THEN
    -- البحث باستخدام variant_id
    SELECT quantity, reserved_quantity INTO current_quantity, current_reserved
    FROM public.inventory
    WHERE product_id = p_product_id AND variant_id = p_sku;
  ELSE
    -- البحث باستخدام product_id فقط
    SELECT quantity, reserved_quantity INTO current_quantity, current_reserved
    FROM public.inventory
    WHERE product_id = p_product_id AND variant_id IS NULL;
  END IF;

  -- التحقق من وجود المخزون
  IF current_quantity IS NULL THEN
    RAISE EXCEPTION 'المنتج غير موجود في المخزون';
  END IF;

  -- حساب الكمية المحجوزة الجديدة
  new_reserved := current_reserved + p_quantity_change;

  -- التحقق من عدم تجاوز الكمية المتاحة
  IF new_reserved > current_quantity THEN
    RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون';
  END IF;

  -- التحقق من عدم النزول تحت الصفر
  IF new_reserved < 0 THEN
    new_reserved := 0;
  END IF;

  -- تحديث الكمية المحجوزة
  IF p_sku IS NOT NULL THEN
    UPDATE public.inventory 
    SET reserved_quantity = new_reserved,
        updated_at = now()
    WHERE product_id = p_product_id AND variant_id = p_sku;
  ELSE
    UPDATE public.inventory 
    SET reserved_quantity = new_reserved,
        updated_at = now()
    WHERE product_id = p_product_id AND variant_id IS NULL;
  END IF;
END;
$$;