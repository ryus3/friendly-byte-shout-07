-- تحديث دالة استخراج المنتجات لتطابق "ميديم" مع "M"
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
  v_color record;
  v_size record;
  v_quantity integer := 1;
  v_current_item jsonb;
  v_found_products jsonb := '[]';
  v_found_colors jsonb := '[]';
  v_found_sizes jsonb := '[]';
  v_variant record;
  v_inventory record;
  v_price numeric := 0;
  v_alternatives jsonb := '[]';
  v_normalized_word text;
  v_product_id uuid;
  v_color_id uuid;
  v_size_id uuid;
  v_final_items jsonb := '[]';
  v_temp_product jsonb;
  v_temp_color jsonb;
  v_temp_size jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE 'بدء استخراج المنتجات من النص: %', input_text;
  
  -- تقسيم النص إلى كلمات وتطبيع النص
  v_words := string_to_array(lower(trim(input_text)), ' ');
  
  -- البحث عن المنتجات بطريقة محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    -- تخطي الكلمات القصيرة جداً
    IF length(v_normalized_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث في أسماء المنتجات مع مرادفات محسنة
    FOR v_product IN 
      SELECT id, name, base_price, cost_price 
      FROM products 
      WHERE (
        lower(name) ILIKE '%' || v_normalized_word || '%' 
        OR lower(name) ILIKE '%ارجنتين%' AND v_normalized_word = 'ارجنتين'
        OR lower(name) ILIKE '%برشلونة%' AND v_normalized_word = 'برشلونة'
        OR lower(name) ILIKE '%ريال%' AND v_normalized_word = 'ريال'
        OR lower(name) ILIKE '%اياكس%' AND v_normalized_word = 'اياكس'
        OR lower(name) ILIKE '%باريس%' AND v_normalized_word = 'باريس'
        OR lower(name) ILIKE '%مانشستر%' AND v_normalized_word = 'مانشستر'
        OR lower(name) ILIKE '%ليفربول%' AND v_normalized_word = 'ليفربول'
        OR lower(name) ILIKE '%تشيلسي%' AND v_normalized_word = 'تشيلسي'
        OR lower(name) ILIKE '%مان%' AND v_normalized_word = 'مان'
      )
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
          WHEN lower(name) ILIKE '%' || v_normalized_word || '%' THEN 3
          ELSE 4
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'base_price', COALESCE(v_product.base_price, 0),
        'cost_price', COALESCE(v_product.cost_price, 0)
      );
      
      -- تجنب التكرار
      IF NOT (v_temp_product = ANY(SELECT jsonb_array_elements(v_found_products))) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
        RAISE NOTICE 'تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان مع مرادفات محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    -- البحث المباشر في الألوان
    FOR v_color IN 
      SELECT id, name 
      FROM colors 
      WHERE (
        lower(name) ILIKE '%' || v_normalized_word || '%'
        OR (lower(name) = 'ازرق' AND v_normalized_word IN ('سمائي', 'أزرق', 'ازرق'))
        OR (lower(name) = 'بني' AND v_normalized_word IN ('بني', 'بنية'))
        OR (lower(name) = 'اسود' AND v_normalized_word IN ('أسود', 'اسود'))
        OR (lower(name) = 'ابيض' AND v_normalized_word IN ('أبيض', 'ابيض'))
        OR (lower(name) = 'احمر' AND v_normalized_word IN ('أحمر', 'احمر'))
        OR (lower(name) = 'اخضر' AND v_normalized_word IN ('أخضر', 'اخضر'))
        OR (lower(name) = 'اصفر' AND v_normalized_word IN ('أصفر', 'اصفر'))
      )
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_color := jsonb_build_object('id', v_color.id, 'name', v_color.name);
      IF NOT (v_temp_color = ANY(SELECT jsonb_array_elements(v_found_colors))) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
        RAISE NOTICE 'تم العثور على اللون: % (ID: %)', v_color.name, v_color.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام مع مرادفات محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    FOR v_size IN 
      SELECT id, name 
      FROM sizes 
      WHERE (
        lower(name) ILIKE '%' || v_normalized_word || '%'
        OR (lower(name) = 'M' AND v_normalized_word IN ('ميديم', 'وسط', 'm', 'medium'))
        OR (lower(name) = 'L' AND v_normalized_word IN ('لارج', 'كبير', 'l', 'large'))
        OR (lower(name) = 'S' AND v_normalized_word IN ('سمول', 'صغير', 's', 'small'))
        OR (lower(name) = 'XL' AND v_normalized_word IN ('اكس لارج', 'xl', 'xlarge'))
        OR (lower(name) = 'XXL' AND v_normalized_word IN ('اكس اكس لارج', 'xxl', 'xxlarge'))
      )
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_size := jsonb_build_object('id', v_size.id, 'name', v_size.name);
      IF NOT (v_temp_size = ANY(SELECT jsonb_array_elements(v_found_sizes))) THEN
        v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
        RAISE NOTICE 'تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- دمج النتائج وإنشاء العناصر النهائية
  IF jsonb_array_length(v_found_products) > 0 THEN
    FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
    LOOP
      v_product_id := (v_current_item->>'id')::uuid;
      v_price := COALESCE((v_current_item->>'base_price')::numeric, 0);
      
      -- الافتراضي: لون وحجم افتراضيان إذا لم يتم العثور عليهما
      v_color_id := CASE 
        WHEN jsonb_array_length(v_found_colors) > 0 THEN 
          (v_found_colors->0->>'id')::uuid
        ELSE NULL
      END;
      
      v_size_id := CASE 
        WHEN jsonb_array_length(v_found_sizes) > 0 THEN 
          (v_found_sizes->0->>'id')::uuid
        ELSE NULL
      END;
      
      -- إنشاء عنصر المنتج النهائي
      v_final_items := v_final_items || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_current_item->>'name',
          'color_id', v_color_id,
          'color_name', CASE WHEN v_color_id IS NOT NULL THEN v_found_colors->0->>'name' ELSE 'افتراضي' END,
          'size_id', v_size_id,
          'size_name', CASE WHEN v_size_id IS NOT NULL THEN v_found_sizes->0->>'name' ELSE 'افتراضي' END,
          'quantity', v_quantity,
          'unit_price', v_price,
          'total_price', v_price * v_quantity
        )
      );
    END LOOP;
  END IF;
  
  RAISE NOTICE 'انتهى استخراج المنتجات. تم العثور على % عنصر', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;