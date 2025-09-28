-- إعادة دالة extract_product_items_from_text إلى النسخة الأصلية البسيطة مع إصلاح اسم العمود
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb := '[]';
  v_words text[];
  v_word text;
  v_product record;
  v_normalized_text text;
  v_variant record;
  v_item_result jsonb;
  v_variant_price numeric := 20000; -- سعر افتراضي
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتج في النص
  FOR v_product IN
    SELECT p.id, p.name, p.base_price
    FROM products p
    WHERE p.is_active = true
    ORDER BY length(p.name) DESC
  LOOP
    IF lower(v_normalized_text) LIKE '%' || lower(v_product.name) || '%' THEN
      RAISE NOTICE '🎯 تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      
      -- البحث عن أول متغير متوفر للمنتج
      SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
             COALESCE(pv.price, v_product.base_price, 20000) as variant_price
      INTO v_variant
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product.id
        AND pv.is_active = true
        AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
      ORDER BY pv.created_at
      LIMIT 1;
      
      -- إذا لم نجد متغير متوفر، خذ أي متغير نشط
      IF v_variant.id IS NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
        ORDER BY pv.created_at
        LIMIT 1;
      END IF;
      
      -- إنشاء عنصر المنتج
      IF v_variant.id IS NOT NULL THEN
        v_item_result := jsonb_build_object(
          'product_id', v_product.id,
          'variant_id', v_variant.id,
          'product_name', v_product.name,
          'color', COALESCE(v_variant.color_name, 'افتراضي'),
          'size', COALESCE(v_variant.size_name, 'افتراضي'),
          'quantity', 1,
          'unit_price', v_variant.variant_price,
          'total_price', v_variant.variant_price,
          'barcode', v_variant.barcode
        );
        
        v_result := v_result || jsonb_build_array(v_item_result);
        RAISE NOTICE '✅ تم إضافة المنتج: %', v_item_result;
      ELSE
        RAISE NOTICE '❌ لم يتم العثور على متغيرات للمنتج: %', v_product.name;
      END IF;
      
      EXIT; -- خروج بعد العثور على أول منتج
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ انتهاء الاستخراج، النتيجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;