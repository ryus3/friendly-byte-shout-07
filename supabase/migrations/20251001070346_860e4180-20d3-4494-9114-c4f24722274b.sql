-- ===================================================================
-- تحديث دالة extract_product_items_from_text لإضافة فلترة الصلاحيات
-- ===================================================================

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  input_text text,
  p_employee_id uuid DEFAULT NULL  -- معامل جديد اختياري لتطبيق الصلاحيات
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parts text[];
  v_part text;
  v_words text[];
  v_word text;
  v_product_items jsonb := '[]';
  v_quantity integer := 1;
  v_found_product record;
  v_found_color record;
  v_found_size record;
  v_variant record;
  v_alternatives text := '';
  v_normalized_text text;
  v_color_requested boolean := false;
  v_size_requested boolean := false;
  v_smart_alternatives text := '';
  v_last_product_id uuid := NULL;
  v_last_product_name text := NULL;
  v_last_color_id uuid := NULL;
  v_last_color_name text := NULL;
  v_item_result jsonb;
  
  -- متغيرات الصلاحيات الجديدة
  v_has_full_access boolean := false;
  v_allowed_categories uuid[];
  v_allowed_departments uuid[];
  v_allowed_types uuid[];
  v_allowed_seasons uuid[];
  v_allowed_colors uuid[];
  v_allowed_sizes uuid[];
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- ===================================================================
  -- جلب صلاحيات الموظف إذا تم تمرير employee_id
  -- ===================================================================
  IF p_employee_id IS NOT NULL THEN
    RAISE NOTICE '🔐 التحقق من صلاحيات الموظف: %', p_employee_id;
    
    SELECT 
      COALESCE(upp.has_full_product_access, false),
      COALESCE(upp.allowed_categories, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_departments, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_product_types, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_seasons_occasions, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_colors, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_sizes, ARRAY[]::uuid[])
    INTO 
      v_has_full_access,
      v_allowed_categories,
      v_allowed_departments,
      v_allowed_types,
      v_allowed_seasons,
      v_allowed_colors,
      v_allowed_sizes
    FROM user_product_permissions upp
    WHERE upp.user_id = p_employee_id
    LIMIT 1;
    
    -- إذا لم توجد صلاحيات، نفترض عدم وجود وصول
    IF NOT FOUND THEN
      v_has_full_access := false;
      v_allowed_categories := ARRAY[]::uuid[];
      v_allowed_departments := ARRAY[]::uuid[];
      v_allowed_types := ARRAY[]::uuid[];
      v_allowed_seasons := ARRAY[]::uuid[];
      v_allowed_colors := ARRAY[]::uuid[];
      v_allowed_sizes := ARRAY[]::uuid[];
      RAISE NOTICE '⚠️ لم توجد صلاحيات للموظف';
    END IF;
    
    RAISE NOTICE '✅ صلاحيات الموظف: full_access=%, categories=%, departments=%', 
      v_has_full_access, array_length(v_allowed_categories, 1), array_length(v_allowed_departments, 1);
  ELSE
    -- إذا لم يتم تمرير employee_id، نعطي وصول كامل (السلوك الحالي)
    v_has_full_access := true;
    RAISE NOTICE '🌐 لم يتم تمرير employee_id، وصول كامل';
  END IF;
  
  -- تقسيم النص على علامة +
  v_parts := string_to_array(input_text, '+');
  
  -- معالجة كل جزء على حدة
  FOREACH v_part IN ARRAY v_parts
  LOOP
    -- إعادة تعيين المتغيرات لكل جزء
    v_quantity := 1;
    v_found_product := NULL;
    v_found_color := NULL;
    v_found_size := NULL;
    v_variant := NULL;
    v_color_requested := false;
    v_size_requested := false;
    v_alternatives := '';
    v_smart_alternatives := '';
    
    RAISE NOTICE '📦 معالجة الجزء: %', v_part;
    
    -- تطبيع النص وتقسيمه إلى كلمات
    v_normalized_text := regexp_replace(
      regexp_replace(v_part, E'[\r\n]+', ' ', 'g'),
      E'\\s+', ' ', 'g'
    );
    v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
    
    -- البحث عن الكمية
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_word ~ '^[0-9]{1,3}$' AND v_word::integer BETWEEN 1 AND 100 THEN
        v_quantity := v_word::integer;
        RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
      END IF;
    END LOOP;
    
    -- ===================================================================
    -- البحث عن المنتج مع تطبيق فلترة الصلاحيات
    -- ===================================================================
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF length(v_word) < 2 THEN CONTINUE; END IF;
      
      SELECT p.id, p.name INTO v_found_product
      FROM products p 
      WHERE p.is_active = true 
        AND (lower(p.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(p.name) || '%')
        -- تطبيق فلترة الصلاحيات هنا
        AND (
          v_has_full_access = true  -- إذا كان لديه وصول كامل
          OR (
            -- أو إذا كان المنتج ضمن الصلاحيات المسموحة
            (array_length(v_allowed_categories, 1) IS NULL OR array_length(v_allowed_categories, 1) = 0 OR p.category_id = ANY(v_allowed_categories))
            AND (array_length(v_allowed_departments, 1) IS NULL OR array_length(v_allowed_departments, 1) = 0 OR p.department_id = ANY(v_allowed_departments))
            AND (array_length(v_allowed_types, 1) IS NULL OR array_length(v_allowed_types, 1) = 0 OR p.product_type_id = ANY(v_allowed_types))
            AND (array_length(v_allowed_seasons, 1) IS NULL OR array_length(v_allowed_seasons, 1) = 0 OR p.season_occasion_id = ANY(v_allowed_seasons))
          )
        )
      ORDER BY 
        CASE WHEN lower(p.name) = v_word THEN 1
             WHEN lower(p.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_found_product.id IS NOT NULL THEN
        v_last_product_id := v_found_product.id;
        v_last_product_name := v_found_product.name;
        RAISE NOTICE '🎯 تم العثور على المنتج: %', v_found_product.name;
        EXIT;
      END IF;
    END LOOP;
    
    -- إذا لم نجد منتج في الجزء الحالي، استخدم المنتج السابق
    IF v_found_product.id IS NULL AND v_last_product_id IS NOT NULL THEN
      v_found_product.id := v_last_product_id;
      v_found_product.name := v_last_product_name;
      RAISE NOTICE '🔄 استخدام المنتج السابق: %', v_found_product.name;
    END IF;
    
    -- إذا لم يتم العثور على منتج نهائياً
    IF v_found_product.id IS NULL THEN
      RAISE NOTICE '⚠️ لم يتم العثور على منتج في الجزء: %', v_part;
      
      -- إذا كان هذا أول جزء، نرجع خطأ
      IF array_length(v_parts, 1) = 1 OR v_last_product_id IS NULL THEN
        RETURN jsonb_build_array(
          jsonb_build_object(
            'product_name', 'غير محدد',
            'color', 'افتراضي',
            'size', 'افتراضي',
            'quantity', v_quantity,
            'price', 0,
            'total_price', 0,
            'is_available', false,
            'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 
              CASE 
                WHEN p_employee_id IS NOT NULL THEN 'لم يتم التعرف على منتج ضمن صلاحياتك في الطلب'
                ELSE 'لم يتم التعرف على أي منتج في الطلب'
              END
          )
        );
      ELSE
        -- إذا كان جزء لاحق، نتجاهل هذا الجزء ونكمل
        CONTINUE;
      END IF;
    END IF;
    
    -- ===================================================================
    -- البحث عن اللون مع فلترة الصلاحيات
    -- ===================================================================
    FOREACH v_word IN ARRAY v_words
    LOOP
      SELECT c.id, c.name INTO v_found_color
      FROM colors c 
      WHERE (lower(c.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(c.name) || '%')
        -- تطبيق فلترة اللون
        AND (
          v_has_full_access = true
          OR array_length(v_allowed_colors, 1) IS NULL 
          OR array_length(v_allowed_colors, 1) = 0 
          OR c.id = ANY(v_allowed_colors)
        )
      LIMIT 1;
      
      IF v_found_color.id IS NOT NULL THEN
        v_color_requested := true;
        v_last_color_id := v_found_color.id;
        v_last_color_name := v_found_color.name;
        RAISE NOTICE '🎨 تم العثور على اللون: %', v_found_color.name;
        EXIT;
      ELSE
        IF v_word IN ('احمر', 'اخضر', 'اصفر', 'برتقالي', 'بنفسجي', 'وردي', 'رمادي', 'بني') THEN
          v_color_requested := true;
          v_found_color.name := v_word;
          RAISE NOTICE '🎨 تم طلب لون غير متوفر أو غير مسموح: %', v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
    -- إذا لم نجد لون في الجزء الحالي، استخدم اللون السابق
    IF v_found_color.id IS NULL AND NOT v_color_requested AND v_last_color_id IS NOT NULL THEN
      -- التحقق من أن اللون السابق ضمن الصلاحيات
      IF v_has_full_access = true 
         OR array_length(v_allowed_colors, 1) IS NULL 
         OR array_length(v_allowed_colors, 1) = 0 
         OR v_last_color_id = ANY(v_allowed_colors) THEN
        v_found_color.id := v_last_color_id;
        v_found_color.name := v_last_color_name;
        v_color_requested := true;
        RAISE NOTICE '🔄 استخدام اللون السابق: %', v_found_color.name;
      END IF;
    END IF;
    
    -- ===================================================================
    -- البحث عن الحجم مع فلترة الصلاحيات
    -- ===================================================================
    FOREACH v_word IN ARRAY v_words
    LOOP
      SELECT s.id, s.name INTO v_found_size
      FROM sizes s 
      WHERE (lower(s.name) = v_word
         OR (v_word = 'ميديم' AND lower(s.name) = 'm')
         OR (v_word = 'لارج' AND lower(s.name) = 'l')
         OR (v_word = 'اكس' AND lower(s.name) = 'xl')
         OR (v_word = 'سمول' AND lower(s.name) = 's')
         OR lower(s.name) LIKE '%' || v_word || '%')
        -- تطبيق فلترة الحجم
        AND (
          v_has_full_access = true
          OR array_length(v_allowed_sizes, 1) IS NULL 
          OR array_length(v_allowed_sizes, 1) = 0 
          OR s.id = ANY(v_allowed_sizes)
        )
      LIMIT 1;
      
      IF v_found_size.id IS NOT NULL THEN
        v_size_requested := true;
        RAISE NOTICE '📏 تم العثور على الحجم: %', v_found_size.name;
        EXIT;
      ELSE
        IF v_word IN ('ميديم', 'لارج', 'سمول', 'اكس', 'دبل', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl') THEN
          v_size_requested := true;
          v_found_size.name := v_word;
          RAISE NOTICE '📏 تم طلب حجم غير متوفر أو غير مسموح: %', v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
    -- البحث عن المتغير المحدد
    IF (NOT v_color_requested OR v_found_color.id IS NOT NULL) 
       AND (NOT v_size_requested OR v_found_size.id IS NOT NULL) THEN
      
      SELECT pv.id, pv.price, COALESCE(i.quantity - i.reserved_quantity, 0) as available_stock
      INTO v_variant
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product.id
        AND (v_found_color.id IS NULL OR pv.color_id = v_found_color.id)
        AND (v_found_size.id IS NULL OR pv.size_id = v_found_size.id)
      ORDER BY COALESCE(i.quantity - i.reserved_quantity, 0) DESC
      LIMIT 1;
      
      IF v_variant.id IS NOT NULL AND v_variant.available_stock >= v_quantity THEN
        RAISE NOTICE '✅ المنتج متوفر';
        v_item_result := jsonb_build_object(
          'product_name', v_found_product.name,
          'color', COALESCE(v_found_color.name, 'افتراضي'),
          'size', COALESCE(v_found_size.name, 'افتراضي'),
          'quantity', v_quantity,
          'price', COALESCE(v_variant.price, 15000),
          'total_price', COALESCE(v_variant.price, 15000) * v_quantity,
          'is_available', true,
          'alternatives_message', ''
        );
        v_product_items := v_product_items || jsonb_build_array(v_item_result);
        CONTINUE;
      END IF;
    END IF;
    
    -- إنشاء رسالة البدائل الذكية (فقط للمنتجات المسموحة)
    WITH available_variants AS (
      SELECT DISTINCT 
        c.name as color_name,
        s.name as size_name,
        c.id as color_id
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product.id
        AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0
        -- فلترة البدائل حسب الصلاحيات
        AND (
          v_has_full_access = true
          OR (array_length(v_allowed_colors, 1) IS NULL OR array_length(v_allowed_colors, 1) = 0 OR c.id = ANY(v_allowed_colors))
        )
        AND (
          v_has_full_access = true
          OR (array_length(v_allowed_sizes, 1) IS NULL OR array_length(v_allowed_sizes, 1) = 0 OR s.id = ANY(v_allowed_sizes))
        )
      ORDER BY c.name, s.name
    ),
    color_sizes AS (
      SELECT 
        color_name,
        string_agg(size_name, ', ' ORDER BY 
          CASE size_name 
            WHEN 'XS' THEN 1 
            WHEN 'S' THEN 2 
            WHEN 'M' THEN 3 
            WHEN 'L' THEN 4 
            WHEN 'XL' THEN 5 
            WHEN 'XXL' THEN 6 
            ELSE 7 
          END
        ) as sizes
      FROM available_variants
      GROUP BY color_name, color_id
      ORDER BY color_name
    )
    SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
    INTO v_smart_alternatives
    FROM color_sizes;
    
    -- إنشاء رسائل الخطأ
    IF v_color_requested AND v_found_color.id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" غير متوفر' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, v_found_color.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_size_requested AND v_found_size.id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" القياس "%s" غير متوفر' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant.id IS NOT NULL AND v_variant.available_stock < v_quantity THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" القياس "%s" المتاح حاليا %s (مطلوب %s)' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, 
        COALESCE(v_found_color.name, 'افتراضي'), 
        COALESCE(v_found_size.name, 'افتراضي'),
        v_variant.available_stock, 
        v_quantity, 
        COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant.id IS NULL THEN
      IF v_color_requested AND v_size_requested THEN
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" اللون "%s" القياس "%s" غير متوفر' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
          v_found_product.name, v_found_color.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      ELSE
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" غير متوفر بالمواصفات المطلوبة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
          v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      END IF;
    ELSE
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' || 
        'المنتج "%s" غير متوفر حالياً' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    END IF;
    
    RAISE NOTICE '📝 رسالة الخطأ: %', v_alternatives;
    
    v_item_result := jsonb_build_object(
      'product_name', v_found_product.name,
      'color', COALESCE(v_found_color.name, 'غير محدد'),
      'size', COALESCE(v_found_size.name, 'غير محدد'),
      'quantity', v_quantity,
      'price', 15000,
      'total_price', 15000 * v_quantity,
      'is_available', false,
      'alternatives_message', v_alternatives
    );
    v_product_items := v_product_items || jsonb_build_array(v_item_result);
  END LOOP;
  
  -- إذا لم نجد أي منتجات
  IF jsonb_array_length(v_product_items) = 0 THEN
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 
          CASE 
            WHEN p_employee_id IS NOT NULL THEN 'لم يتم التعرف على منتج ضمن صلاحياتك في الطلب'
            ELSE 'لم يتم التعرف على أي منتج في الطلب'
          END
      )
    );
  END IF;
  
  RETURN v_product_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ', 
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'حدث خطأ في معالجة طلبك'
      )
    );
END;
$function$;

-- ===================================================================
-- تحديث دالة process_telegram_order لتمرير employee_id
-- ===================================================================

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_default_customer_name text := 'زبون تليغرام';
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_city_id integer;
  v_region_id integer;
  v_products jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_lines text[];
  v_line text;
  v_first_line text;
  v_address_line text;
  v_city_found boolean := false;
  v_name_from_text text;
  v_result jsonb;
  v_city_record record;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام - كود الموظف: %, النص: %', p_employee_code, p_message_text;

  -- 1. العثور على user_id من employee_code
  SELECT user_id INTO v_user_id
  FROM telegram_employee_codes
  WHERE telegram_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ كود الموظف غير صحيح: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على المستخدم: %', v_user_id;

  -- 2. قراءة default_customer_name من profiles
  SELECT COALESCE(NULLIF(TRIM(default_customer_name), ''), 'زبون تليغرام')
  INTO v_default_customer_name
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  RAISE NOTICE '📝 الاسم الافتراضي من الإعدادات: %', v_default_customer_name;

  -- 3. تقسيم النص إلى أسطر
  v_lines := string_to_array(p_message_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), '');

  -- 4. استخراج الاسم الذكي من السطر الأول
  IF v_first_line != '' THEN
    SELECT COUNT(*) > 0 INTO v_city_found
    FROM cities_cache cc
    WHERE cc.is_active = true
      AND (
        lower(v_first_line) LIKE lower(cc.name) || '%'
        OR lower(v_first_line) LIKE '%' || lower(cc.name) || '%'
      );
    
    IF NOT v_city_found AND v_first_line !~ '[0-9]' AND length(v_first_line) > 2 AND length(v_first_line) < 50 THEN
      v_name_from_text := v_first_line;
      RAISE NOTICE '✅ تم استخراج الاسم من السطر الأول: %', v_name_from_text;
    END IF;
  END IF;

  v_customer_name := COALESCE(v_name_from_text, v_default_customer_name);
  RAISE NOTICE '👤 الاسم النهائي: %', v_customer_name;

  -- 5. استخراج العنوان الذكي
  FOREACH v_line IN ARRAY v_lines
  LOOP
    IF TRIM(v_line) = '' THEN CONTINUE; END IF;
    
    SELECT cc.id, cc.name INTO v_city_record
    FROM cities_cache cc
    WHERE cc.is_active = true
      AND (
        lower(TRIM(v_line)) LIKE lower(cc.name) || '%'
        OR lower(TRIM(v_line)) LIKE lower(cc.name) || ' %'
      )
    ORDER BY length(cc.name) DESC
    LIMIT 1;
    
    IF v_city_record.id IS NOT NULL THEN
      v_city_id := v_city_record.id;
      v_customer_city := v_city_record.name;
      v_address_line := TRIM(v_line);
      
      v_customer_address := TRIM(regexp_replace(v_address_line, '^' || v_customer_city || '\s*-?\s*', '', 'i'));
      
      IF v_customer_address = '' OR v_customer_address = v_customer_city THEN
        v_customer_address := v_address_line;
      END IF;
      
      RAISE NOTICE '🏙️ المدينة: % (ID: %), العنوان: %', v_customer_city, v_city_id, v_customer_address;
      EXIT;
    END IF;
  END LOOP;

  IF v_city_id IS NULL THEN
    v_customer_address := p_message_text;
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة، استخدام النص الكامل كعنوان';
  END IF;

  -- 6. استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;

  -- ===================================================================
  -- 7. استخراج المنتجات مع تمرير employee_id لتطبيق الصلاحيات
  -- ===================================================================
  v_products := extract_product_items_from_text(p_message_text, v_user_id);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_products;

  -- 8. حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) AS item;

  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي مع التوصيل: %', v_total_amount;

  -- 9. إنشاء ai_order
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    city_id,
    region_id,
    items,
    total_amount,
    status,
    source,
    telegram_chat_id,
    created_by,
    original_text,
    order_data
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_city_id,
    v_region_id,
    v_products,
    v_total_amount,
    'pending',
    'telegram',
    p_telegram_chat_id,
    v_user_id::text,
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'delivery_fee', v_delivery_fee
    )
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء AI Order: %', v_ai_order_id;

  -- 10. إرجاع البيانات
  v_result := jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_city', v_customer_city,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'products', v_products,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'created_by', v_user_id
    )
  );

  RAISE NOTICE '✅ نجح إنشاء الطلب الذكي';
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;