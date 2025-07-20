-- إضافة المنتج الصحيح من فاتورة 2
DO $$
DECLARE
  sky_color_id uuid;
  s_size_id uuid;
  existing_product_id uuid;
  new_variant_id uuid;
  current_user_id uuid;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- الحصول على اللون السمائي
  SELECT id INTO sky_color_id FROM public.colors WHERE name = 'سمائي' LIMIT 1;
  
  -- إذا لم يوجد اللون السمائي، إنشاؤه
  IF sky_color_id IS NULL THEN
    INSERT INTO public.colors (name, hex_code) 
    VALUES ('سمائي', '#09dffb') 
    RETURNING id INTO sky_color_id;
  END IF;
  
  -- الحصول على مقاس S
  SELECT id INTO s_size_id FROM public.sizes WHERE name = 'S' LIMIT 1;
  
  -- إذا لم يوجد مقاس S، إنشاؤه
  IF s_size_id IS NULL THEN
    INSERT INTO public.sizes (name, type, display_order) 
    VALUES ('S', 'letter', 1) 
    RETURNING id INTO s_size_id;
  END IF;
  
  -- البحث عن منتج "سوت شيك" الموجود
  SELECT id INTO existing_product_id 
  FROM public.products 
  WHERE name = 'سوت شيك' 
  LIMIT 1;
  
  -- إذا وُجد المنتج، إضافة متغير جديد له
  IF existing_product_id IS NOT NULL THEN
    -- التحقق من عدم وجود متغير بنفس المواصفات
    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants 
      WHERE product_id = existing_product_id 
      AND color_id = sky_color_id 
      AND size_id = s_size_id
    ) THEN
      -- إنشاء متغير جديد
      INSERT INTO public.product_variants (
        product_id,
        color_id,
        size_id,
        barcode,
        sku,
        price,
        cost_price,
        is_active
      ) VALUES (
        existing_product_id,
        sky_color_id,
        s_size_id,
        'RYUS-1752979662559-L5E4',
        'RYUS-1752979662559-L5E4',
        50000,
        29000,
        true
      ) RETURNING id INTO new_variant_id;
      
      -- إضافة المتغير للمخزون
      INSERT INTO public.inventory (
        product_id,
        variant_id,
        quantity,
        min_stock,
        reserved_quantity,
        last_updated_by
      ) VALUES (
        existing_product_id,
        new_variant_id,
        1,
        0,
        0,
        current_user_id
      );
      
      RAISE NOTICE 'تم إضافة متغير سوت شيك سمائي مقاس S بنجاح';
    ELSE
      RAISE NOTICE 'متغير سوت شيك سمائي مقاس S موجود مسبقاً';
    END IF;
  ELSE
    RAISE NOTICE 'لم يتم العثور على منتج سوت شيك';
  END IF;
END $$;