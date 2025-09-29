-- إسقاط الدالة الموجودة وإعادة إنشائها مع التحسينات

-- إسقاط الدالة الموجودة
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- إنشاء دالة ترجمة الألوان العربية المحسنة
CREATE OR REPLACE FUNCTION public.translate_arabic_color(arabic_color text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN CASE lower(trim(arabic_color))
    -- الألوان الأساسية (بدون همزة في ازرق لمطابقة قاعدة البيانات)
    WHEN 'ازرق' THEN 'ازرق'
    WHEN 'أزرق' THEN 'ازرق'  -- تصحيح الهمزة
    WHEN 'زرقاء' THEN 'ازرق'
    WHEN 'blue' THEN 'ازرق'
    
    WHEN 'اسود' THEN 'اسود'
    WHEN 'أسود' THEN 'اسود'
    WHEN 'سوداء' THEN 'اسود'
    WHEN 'black' THEN 'اسود'
    
    WHEN 'ابيض' THEN 'ابيض'
    WHEN 'أبيض' THEN 'ابيض'
    WHEN 'بيضاء' THEN 'ابيض'
    WHEN 'white' THEN 'ابيض'
    
    WHEN 'احمر' THEN 'احمر'
    WHEN 'أحمر' THEN 'احمر'
    WHEN 'حمراء' THEN 'احمر'
    WHEN 'red' THEN 'احمر'
    
    WHEN 'اخضر' THEN 'اخضر'
    WHEN 'أخضر' THEN 'اخضر'
    WHEN 'خضراء' THEN 'اخضر'
    WHEN 'green' THEN 'اخضر'
    
    WHEN 'اصفر' THEN 'اصفر'
    WHEN 'أصفر' THEN 'اصفر'
    WHEN 'صفراء' THEN 'اصفر'
    WHEN 'yellow' THEN 'اصفر'
    
    WHEN 'برتقالي' THEN 'برتقالي'
    WHEN 'orange' THEN 'برتقالي'
    
    WHEN 'بنفسجي' THEN 'بنفسجي'
    WHEN 'موف' THEN 'بنفسجي'
    WHEN 'purple' THEN 'بنفسجي'
    
    WHEN 'وردي' THEN 'وردي'
    WHEN 'زهري' THEN 'وردي'
    WHEN 'pink' THEN 'وردي'
    
    WHEN 'بني' THEN 'بني'
    WHEN 'brown' THEN 'بني'
    
    WHEN 'رمادي' THEN 'رمادي'
    WHEN 'gray' THEN 'رمادي'
    WHEN 'grey' THEN 'رمادي'
    
    -- الألوان المتنوعة
    WHEN 'ذهبي' THEN 'ذهبي'
    WHEN 'gold' THEN 'ذهبي'
    
    WHEN 'فضي' THEN 'فضي'
    WHEN 'silver' THEN 'فضي'
    
    WHEN 'بيج' THEN 'بيج'
    WHEN 'beige' THEN 'بيج'
    
    WHEN 'كحلي' THEN 'كحلي'
    WHEN 'navy' THEN 'كحلي'
    
    ELSE arabic_color
  END;
END;
$function$;

-- إنشاء دالة ترجمة الأحجام العربية مع جميع المرادفات المطلوبة
CREATE OR REPLACE FUNCTION public.translate_arabic_size(arabic_size text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN CASE lower(trim(arabic_size))
    -- مرادفات S
    WHEN 'سمول' THEN 'S'
    WHEN 'small' THEN 'S'
    WHEN 's' THEN 'S'
    
    -- مرادفات M (تصحيح ميديم → M بدلاً من m)
    WHEN 'ميديم' THEN 'M'
    WHEN 'مديم' THEN 'M'  -- إضافة مرادف جديد
    WHEN 'medium' THEN 'M'
    WHEN 'm' THEN 'M'
    
    -- مرادفات L
    WHEN 'لارج' THEN 'L'
    WHEN 'large' THEN 'L'
    WHEN 'l' THEN 'L'
    
    -- مرادفات XL
    WHEN 'اكس لارج' THEN 'XL'
    WHEN 'اكسلارج' THEN 'XL'
    WHEN 'اكس و لارج' THEN 'XL'
    WHEN 'xl' THEN 'XL'
    WHEN 'xL' THEN 'XL'
    WHEN 'Xl' THEN 'XL'
    
    -- مرادفات XXL
    WHEN 'اكسين' THEN 'XXL'
    WHEN 'اكسين لارج' THEN 'XXL'
    WHEN 'اكسينلارج' THEN 'XXL'
    WHEN 'اكسين و لارج' THEN 'XXL'
    WHEN 'xxl' THEN 'XXL'
    WHEN 'xXL' THEN 'XXL'
    WHEN 'XxL' THEN 'XXL'
    
    -- مرادفات XXXL
    WHEN 'ثلاث اكس' THEN 'XXXL'
    WHEN 'ثلاثة اكس' THEN 'XXXL'
    WHEN '3 اكس' THEN 'XXXL'
    WHEN '3 اكسات' THEN 'XXXL'
    WHEN 'ثلاث اكسات' THEN 'XXXL'
    WHEN 'ثلاثة اكسات' THEN 'XXXL'
    WHEN 'xxxl' THEN 'XXXL'
    WHEN 'XXXL' THEN 'XXXL'
    WHEN 'Xxl' THEN 'XXXL'  -- للحالات المختلطة
    WHEN 'xXL' THEN 'XXXL'
    
    ELSE upper(arabic_size)  -- تحويل إلى أحرف كبيرة افتراضياً
  END;
END;
$function$;

-- إعادة إنشاء دالة استخراج المنتجات مع التحسينات
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_words text[];
  v_word text;
  v_current_product text := NULL;
  v_current_color text := NULL;
  v_current_size text := NULL;
  v_current_quantity integer := 1;
  v_current_price numeric := 0;
  v_found_products text[] := '{}';
  v_found_colors text[] := '{}';
  v_found_sizes text[] := '{}';
  v_product_text text;
  v_translated_color text;
  v_translated_size text;
  v_final_color text;
  v_final_size text;
  v_product_id uuid;
  v_variant_id uuid;
  v_variant_price numeric;
  v_item jsonb;
BEGIN
  RAISE NOTICE '🔍 بدء تحليل النص: %', p_text;
  
  -- استخراج النص الخاص بالمنتجات فقط
  v_product_text := extract_product_text_from_message(p_text);
  RAISE NOTICE '📦 نص المنتجات المستخرج: %', v_product_text;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(lower(trim(v_product_text)), ' ');
  
  -- جمع جميع المنتجات والألوان والأحجام المتوفرة
  SELECT array_agg(DISTINCT lower(name)) INTO v_found_products FROM products WHERE name IS NOT NULL;
  SELECT array_agg(DISTINCT lower(name)) INTO v_found_colors FROM colors WHERE name IS NOT NULL;
  SELECT array_agg(DISTINCT lower(name)) INTO v_found_sizes FROM sizes WHERE name IS NOT NULL;
  
  RAISE NOTICE '🎨 الألوان المتوفرة: %', v_found_colors;
  RAISE NOTICE '📏 الأحجام المتوفرة: %', v_found_sizes;
  
  -- البحث في الكلمات
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    RAISE NOTICE '🔎 معالجة الكلمة: %', v_word;
    
    -- البحث عن المنتج
    IF v_current_product IS NULL THEN
      FOREACH v_product_text IN ARRAY v_found_products
      LOOP
        IF v_product_text LIKE '%' || v_word || '%' OR v_word LIKE '%' || v_product_text || '%' THEN
          v_current_product := v_product_text;
          RAISE NOTICE '✅ تم العثور على المنتج: %', v_current_product;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    -- البحث عن اللون (مع الترجمة المحسنة)
    IF v_current_color IS NULL THEN
      v_translated_color := translate_arabic_color(v_word);
      RAISE NOTICE '🎨 ترجمة اللون: % → %', v_word, v_translated_color;
      
      -- البحث في الألوان المتوفرة
      IF lower(v_translated_color) = ANY(v_found_colors) THEN
        v_current_color := v_translated_color;
        RAISE NOTICE '✅ تم العثور على اللون: %', v_current_color;
      ELSE
        -- البحث المباشر في حالة عدم وجود ترجمة
        IF lower(v_word) = ANY(v_found_colors) THEN
          v_current_color := v_word;
          RAISE NOTICE '✅ تم العثور على اللون مباشرة: %', v_current_color;
        END IF;
      END IF;
    END IF;
    
    -- البحث عن الحجم (مع الترجمة المحسنة)
    IF v_current_size IS NULL THEN
      v_translated_size := translate_arabic_size(v_word);
      RAISE NOTICE '📏 ترجمة الحجم: % → %', v_word, v_translated_size;
      
      -- البحث في الأحجام المتوفرة
      IF lower(v_translated_size) = ANY(v_found_sizes) THEN
        v_current_size := v_translated_size;
        RAISE NOTICE '✅ تم العثور على الحجم: %', v_current_size;
      ELSE
        -- البحث المباشر في حالة عدم وجود ترجمة
        IF lower(v_word) = ANY(v_found_sizes) THEN
          v_current_size := v_word;
          RAISE NOTICE '✅ تم العثور على الحجم مباشرة: %', v_current_size;
        END IF;
      END IF;
    END IF;
    
    -- البحث عن الكمية (الأرقام)
    IF v_word ~ '^[0-9]+$' AND v_word::integer > 0 AND v_word::integer <= 100 THEN
      v_current_quantity := v_word::integer;
      RAISE NOTICE '🔢 تم العثور على الكمية: %', v_current_quantity;
    END IF;
  END LOOP;
  
  -- إذا تم العثور على منتج، قم بإنشاء العنصر
  IF v_current_product IS NOT NULL THEN
    RAISE NOTICE '📋 إنشاء عنصر المنتج: منتج=%, لون=%, حجم=%', v_current_product, v_current_color, v_current_size;
    
    -- استخدام القيم الافتراضية إذا لم توجد
    v_final_color := COALESCE(v_current_color, 'افتراضي');
    v_final_size := COALESCE(v_current_size, 'M');
    
    -- البحث عن معرف المنتج والمتغير
    SELECT id INTO v_product_id FROM products WHERE lower(name) = lower(v_current_product) LIMIT 1;
    
    IF v_product_id IS NOT NULL THEN
      -- البحث عن المتغير المطابق
      SELECT pv.id, pv.price INTO v_variant_id, v_variant_price
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_product_id
        AND lower(c.name) = lower(v_final_color)
        AND lower(s.name) = lower(v_final_size)
      LIMIT 1;
      
      -- إذا لم توجد المتغير المطابق، استخدم أول متغير متوفر
      IF v_variant_id IS NULL THEN
        SELECT pv.id, pv.price INTO v_variant_id, v_variant_price
        FROM product_variants pv
        WHERE pv.product_id = v_product_id
        LIMIT 1;
      END IF;
      
      v_current_price := COALESCE(v_variant_price, 0) * v_current_quantity;
      
      -- إنشاء عنصر المنتج
      v_item := jsonb_build_object(
        'product_name', v_current_product,
        'color', v_final_color,
        'size', v_final_size,
        'quantity', v_current_quantity,
        'unit_price', COALESCE(v_variant_price, 0),
        'total_price', v_current_price,
        'product_id', v_product_id,
        'variant_id', v_variant_id
      );
      
      v_items := v_items || jsonb_build_array(v_item);
      
      RAISE NOTICE '✅ تم إنشاء عنصر: %', v_item::text;
    ELSE
      RAISE NOTICE '❌ لم يتم العثور على معرف المنتج لـ: %', v_current_product;
    END IF;
  ELSE
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
  END IF;
  
  RAISE NOTICE '🏁 النتيجة النهائية: % عنصر', jsonb_array_length(v_items);
  RETURN v_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;