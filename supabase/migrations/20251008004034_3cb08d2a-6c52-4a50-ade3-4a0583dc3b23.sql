-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(TEXT, UUID);

-- إنشاء الدالة المحدثة مع نظام الصلاحيات الصحيح
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  p_text TEXT,
  p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  variant_id UUID,
  color_name TEXT,
  size_name TEXT,
  quantity INTEGER,
  confidence_score NUMERIC,
  match_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized_text TEXT;
  v_words TEXT[];
  v_word TEXT;
  v_color_matches TEXT[] := ARRAY[]::TEXT[];
  v_size_matches TEXT[] := ARRAY[]::TEXT[];
  v_quantity_match INTEGER;
  v_has_full_access BOOLEAN := FALSE;
BEGIN
  -- تطبيع النص
  v_normalized_text := lower(trim(p_text));
  v_words := string_to_array(v_normalized_text, ' ');

  -- فحص الصلاحيات الكاملة
  IF p_employee_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 
      FROM user_product_permissions upp
      WHERE upp.user_id = p_employee_id
        AND upp.has_full_access = false
    ) INTO v_has_full_access;
  ELSE
    v_has_full_access := TRUE;
  END IF;

  -- استخراج الألوان
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    IF EXISTS (
      SELECT 1 FROM colors c 
      WHERE lower(c.name) = v_word
    ) THEN
      v_color_matches := array_append(v_color_matches, v_word);
    END IF;
  END LOOP;

  -- استخراج المقاسات
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    IF EXISTS (
      SELECT 1 FROM sizes s 
      WHERE lower(s.name) = v_word
    ) THEN
      v_size_matches := array_append(v_size_matches, v_word);
    END IF;
  END LOOP;

  -- استخراج الكمية
  v_quantity_match := COALESCE(
    (regexp_match(v_normalized_text, '(\d+)'))[1]::INTEGER,
    1
  );

  -- البحث عن المنتجات المطابقة مع تطبيق الصلاحيات
  RETURN QUERY
  WITH product_matches AS (
    SELECT DISTINCT
      p.id,
      p.name,
      pv.id as variant_id,
      c.name as color,
      s.name as size,
      v_quantity_match as qty,
      CASE
        WHEN lower(p.name) = v_normalized_text THEN 1.0
        WHEN lower(p.name) LIKE '%' || v_normalized_text || '%' THEN 0.8
        WHEN similarity(lower(p.name), v_normalized_text) > 0.3 THEN 0.6
        ELSE 0.4
      END as conf_score
    FROM products p
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    WHERE p.is_active = true
      AND (
        lower(p.name) LIKE '%' || v_normalized_text || '%'
        OR similarity(lower(p.name), v_normalized_text) > 0.3
      )
      -- تطبيق صلاحيات المنتجات
      AND (
        v_has_full_access
        OR p_employee_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'product'
            AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(p.id::text))
        )
      )
      -- تطبيق صلاحيات الفئات
      AND (
        v_has_full_access
        OR p_employee_id IS NULL
        OR p.category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'category'
            AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(p.category_id::text))
        )
      )
      -- تطبيق صلاحيات الأقسام
      AND (
        v_has_full_access
        OR p_employee_id IS NULL
        OR p.department_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'department'
            AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(p.department_id::text))
        )
      )
      -- تطبيق صلاحيات الألوان
      AND (
        v_has_full_access
        OR p_employee_id IS NULL
        OR pv.color_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'color'
            AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(pv.color_id::text))
        )
      )
      -- تطبيق صلاحيات المقاسات
      AND (
        v_has_full_access
        OR p_employee_id IS NULL
        OR pv.size_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'size'
            AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(pv.size_id::text))
        )
      )
      -- فلترة حسب الألوان المستخرجة
      AND (
        array_length(v_color_matches, 1) IS NULL
        OR lower(c.name) = ANY(v_color_matches)
      )
      -- فلترة حسب المقاسات المستخرجة
      AND (
        array_length(v_size_matches, 1) IS NULL
        OR lower(s.name) = ANY(v_size_matches)
      )
    ORDER BY conf_score DESC
    LIMIT 10
  )
  SELECT
    pm.id as product_id,
    pm.name as product_name,
    pm.variant_id,
    pm.color as color_name,
    pm.size as size_name,
    pm.qty as quantity,
    pm.conf_score as confidence_score,
    jsonb_build_object(
      'colors_found', v_color_matches,
      'sizes_found', v_size_matches,
      'quantity_extracted', v_quantity_match,
      'has_permissions', v_has_full_access OR p_employee_id IS NULL
    ) as match_details
  FROM product_matches pm;
END;
$$;