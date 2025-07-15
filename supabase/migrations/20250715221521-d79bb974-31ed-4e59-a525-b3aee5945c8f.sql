CREATE OR REPLACE FUNCTION public.update_reserved_stock(p_product_id uuid, p_quantity_change integer, p_sku text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_quantity INTEGER;
  current_reserved INTEGER;
  new_reserved INTEGER;
  variant_uuid UUID;
BEGIN
  -- العثور على المخزون المناسب
  IF p_sku IS NOT NULL THEN
    -- محاولة تحويل p_sku إلى UUID إذا كان نص، أو استخدامه مباشرة إذا كان UUID
    BEGIN
      variant_uuid := p_sku::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      -- إذا فشل التحويل، البحث عن variant عبر barcode/sku
      SELECT id INTO variant_uuid 
      FROM public.product_variants 
      WHERE product_id = p_product_id AND (barcode = p_sku OR sku = p_sku);
      
      IF variant_uuid IS NULL THEN
        RAISE EXCEPTION 'المتغير غير موجود: %', p_sku;
      END IF;
    END;
    
    -- البحث باستخدام variant_id
    SELECT quantity, reserved_quantity INTO current_quantity, current_reserved
    FROM public.inventory
    WHERE product_id = p_product_id AND variant_id = variant_uuid;
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
    RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون. المتاح: %, المطلوب: %', current_quantity - current_reserved, p_quantity_change;
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
    WHERE product_id = p_product_id AND variant_id = variant_uuid;
  ELSE
    UPDATE public.inventory 
    SET reserved_quantity = new_reserved,
        updated_at = now()
    WHERE product_id = p_product_id AND variant_id IS NULL;
  END IF;
END;
$function$