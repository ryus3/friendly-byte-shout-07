-- تحسين دالة معالجة طلبات التليغرام لحل مشكلة استخراج المنتجات
CREATE OR REPLACE FUNCTION public.extract_product_text_from_message(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_product_text text := '';
  v_phone_pattern text := '07[0-9]{9}';
  v_city_names text[] := ARRAY['بغداد', 'البصرة', 'أربيل', 'السليمانية', 'الموصل', 'النجف', 'كربلاء', 'الديوانية', 'الناصرية', 'العمارة', 'الكوت', 'الرمادي', 'تكريت', 'سامراء', 'الفلوجة', 'القادسية', 'ميسان', 'دهوك', 'كركوك', 'بابل', 'الحلة', 'المثنى', 'صلاح الدين', 'الأنبار', 'واسط', 'ذي قار', 'القادسية'];
BEGIN
  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(input_text, E'\n');
  
  -- البحث عن السطر الذي يحتوي على المنتج
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_line := trim(v_line);
    
    -- تجاهل الأسطر التي تحتوي على أرقام الهواتف
    IF v_line ~ v_phone_pattern THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تحتوي على أسماء المدن فقط
    IF v_line = ANY(v_city_names) THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تحتوي على كلمات عنوان شائعة
    IF v_line ~* '(شارع|حي|منطقة|قضاء|ناحية|مجمع|عمارة|دار|بيت)' THEN
      CONTINUE;
    END IF;
    
    -- إضافة السطر إلى نص المنتج إذا كان يحتوي على كلمات منتج محتملة
    IF v_line ~* '(برشلونة|ارجنتين|سوت شيك|ازرق|احمر|اخضر|ابيض|اسود|صغير|كبير|وسط|سمول|ميديم|لارج|S|M|L|XL)' THEN
      v_product_text := v_product_text || ' ' || v_line;
    END IF;
  END LOOP;
  
  -- إذا لم نجد نص منتج محدد، استخدم النص الكامل مع تنظيف بسيط
  IF trim(v_product_text) = '' THEN
    v_product_text := regexp_replace(input_text, v_phone_pattern, '', 'g');
    v_product_text := regexp_replace(v_product_text, E'[\r\n]+', ' ', 'g');
  END IF;
  
  RETURN trim(v_product_text);
END;
$function$;

-- تحسين دالة استخراج المنتجات لدعم المرادفات العربية
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_items jsonb := '[]';
  v_words text[];
  v_word text;
  v_product_matches jsonb := '[]';
  v_color_matches text[] := '{}';
  v_size_matches text[] := '{}';
  v_final_items jsonb := '[]';
  v_current_quantity integer := 1;
  v_normalized_text text;
  v_arabic_sizes jsonb := '{
    "صغير": "s", "سمول": "s", "small": "s",
    "وسط": "m", "ميديم": "m", "متوسط": "m", "medium": "m", "m": "m",
    "كبير": "l", "لارج": "l", "large": "l", "l": "l",
    "كبير جدا": "xl", "اكس لارج": "xl", "xl": "xl",
    "كبير جدا جدا": "xxl", "xxl": "xxl"
  }';
  v_arabic_colors jsonb := '{
    "ازرق": "أزرق", "احمر": "أحمر", "اخضر": "أخضر", 
    "ابيض": "أبيض", "اسود": "أسود", "اصفر": "أصفر",
    "بنفسجي": "بنفسجي", "وردي": "وردي", "برتقالي": "برتقالي"
  }';
BEGIN
  -- تطبيع النص وإزالة المحتوى غير ذي الصلة
  v_normalized_text := extract_product_text_from_message(input_text);
  v_normalized_text := lower(trim(v_normalized_text));
  v_words := string_to_array(v_normalized_text, ' ');
  
  RAISE NOTICE '🛍️ النص المنظف للمنتجات: %', v_normalized_text;
  
  -- جمع الألوان المتوفرة مع إضافة المرادفات العربية
  WITH color_variants AS (
    SELECT DISTINCT lower(name) as color_name FROM colors WHERE name IS NOT NULL
    UNION
    SELECT DISTINCT lower(key) as color_name 
    FROM jsonb_each_text(v_arabic_colors)
  )
  SELECT array_agg(color_name) INTO v_color_matches FROM color_variants;
  
  -- جمع الأحجام المتوفرة مع إضافة المرادفات العربية
  WITH size_variants AS (
    SELECT DISTINCT lower(name) as size_name FROM sizes WHERE name IS NOT NULL
    UNION
    SELECT DISTINCT lower(key) as size_name 
    FROM jsonb_each_text(v_arabic_sizes)
  )
  SELECT array_agg(size_name) INTO v_size_matches FROM size_variants;
  
  -- البحث عن المنتجات باستخدام الجداول الجسرية الصحيحة
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'base_price', p.base_price,
      'cost_price', p.cost_price,
      'department_name', COALESCE(d.name, 'غير محدد'),
      'category_name', COALESCE(c.name, 'غير محدد'),
      'product_type_name', COALESCE(pt.name, 'غير محدد'),
      'season_name', COALESCE(so.name, 'غير محدد'),
      'variants', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'variant_id', pv.id,
            'sku', pv.sku,
            'color_name', COALESCE(col.name, 'افتراضي'),
            'size_name', COALESCE(sz.name, 'افتراضي'),
            'price', COALESCE(pv.price, p.base_price),
            'cost_price', COALESCE(pv.cost_price, p.cost_price),
            'inventory_quantity', COALESCE(inv.quantity, 0)
          )
        ) FROM product_variants pv
        LEFT JOIN colors col ON pv.color_id = col.id
        LEFT JOIN sizes sz ON pv.size_id = sz.id
        LEFT JOIN inventory inv ON pv.id = inv.variant_id
        WHERE pv.product_id = p.id),
        '[]'::jsonb
      )
    )
  ) INTO v_product_matches
  FROM products p
  LEFT JOIN product_departments pd ON p.id = pd.product_id
  LEFT JOIN departments d ON pd.department_id = d.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories c ON pc.category_id = c.id
  LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
  LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
  LEFT JOIN product_seasons_occasions pso ON p.id = pso.product_id
  LEFT JOIN seasons_occasions so ON pso.season_occasion_id = so.id
  WHERE p.is_active = true
    AND EXISTS (
      SELECT 1 FROM unnest(v_words) AS word
      WHERE lower(p.name) LIKE '%' || word || '%'
        OR lower(COALESCE(d.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(c.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(pt.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(so.name, '')) LIKE '%' || word || '%'
    );
  
  -- معالجة المنتجات المطابقة وإنشاء العناصر النهائية
  IF v_product_matches IS NOT NULL AND jsonb_array_length(v_product_matches) > 0 THEN
    DECLARE
      v_product_item jsonb;
      v_best_variant jsonb;
      v_found_color text := NULL;
      v_found_size text := NULL;
      v_item_price numeric;
      v_item_cost numeric;
      v_translated_size text;
      v_normalized_color text;
    BEGIN
      FOR v_product_item IN SELECT * FROM jsonb_array_elements(v_product_matches)
      LOOP
        -- البحث عن اللون والحجم في النص مع الترجمة
        FOREACH v_word IN ARRAY v_words
        LOOP
          -- البحث عن اللون مع مراعاة المرادفات
          IF v_word = ANY(v_color_matches) AND v_found_color IS NULL THEN
            -- ترجمة اللون إذا كان عربياً
            v_normalized_color := COALESCE(v_arabic_colors->>v_word, v_word);
            v_found_color := v_normalized_color;
          END IF;
          
          -- البحث عن الحجم مع مراعاة المرادفات
          IF v_word = ANY(v_size_matches) AND v_found_size IS NULL THEN
            -- ترجمة الحجم إذا كان عربياً
            v_translated_size := COALESCE(v_arabic_sizes->>v_word, v_word);
            v_found_size := v_translated_size;
          END IF;
        END LOOP;
        
        RAISE NOTICE '🎯 البحث عن متغير: لون=% حجم=%', v_found_color, v_found_size;
        
        -- العثور على أفضل متغير مطابق
        SELECT variant INTO v_best_variant
        FROM jsonb_array_elements(v_product_item->'variants') AS variant
        WHERE (v_found_color IS NULL OR lower(variant->>'color_name') = lower(v_found_color))
          AND (v_found_size IS NULL OR lower(variant->>'size_name') = lower(v_found_size))
        ORDER BY (variant->>'inventory_quantity')::integer DESC
        LIMIT 1;
        
        -- إذا لم يوجد متغير مطابق، استخدم الأول المتوفر
        IF v_best_variant IS NULL THEN
          SELECT variant INTO v_best_variant
          FROM jsonb_array_elements(v_product_item->'variants') AS variant
          ORDER BY (variant->>'inventory_quantity')::integer DESC
          LIMIT 1;
        END IF;
        
        -- تحديد السعر والتكلفة
        IF v_best_variant IS NOT NULL THEN
          v_item_price := (v_best_variant->>'price')::numeric;
          v_item_cost := (v_best_variant->>'cost_price')::numeric;
          
          RAISE NOTICE '✅ تم العثور على متغير: % - % بسعر %', 
            v_best_variant->>'color_name', v_best_variant->>'size_name', v_item_price;
        ELSE
          v_item_price := (v_product_item->>'base_price')::numeric;
          v_item_cost := (v_product_item->>'cost_price')::numeric;
        END IF;
        
        -- إضافة العنصر إلى القائمة النهائية
        v_final_items := v_final_items || jsonb_build_array(
          jsonb_build_object(
            'product_id', v_product_item->>'product_id',
            'product_name', v_product_item->>'product_name',
            'variant_id', COALESCE(v_best_variant->>'variant_id', null),
            'variant_sku', COALESCE(v_best_variant->>'sku', ''),
            'color_name', COALESCE(v_best_variant->>'color_name', 'افتراضي'),
            'size_name', COALESCE(v_best_variant->>'size_name', 'افتراضي'),
            'quantity', v_current_quantity,
            'unit_price', v_item_price,
            'unit_cost', v_item_cost,
            'total_price', v_item_price * v_current_quantity,
            'total_cost', v_item_cost * v_current_quantity,
            'department_name', v_product_item->>'department_name',
            'category_name', v_product_item->>'category_name',
            'product_type_name', v_product_item->>'product_type_name',
            'season_name', v_product_item->>'season_name',
            'inventory_quantity', COALESCE((v_best_variant->>'inventory_quantity')::integer, 0)
          )
        );
        
        -- إعادة تعيين المتغيرات للمنتج التالي
        v_found_color := NULL;
        v_found_size := NULL;
      END LOOP;
    END;
  END IF;
  
  RAISE NOTICE '🛍️ تم استخراج % عنصر من النص المحسن', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات المحسن: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;