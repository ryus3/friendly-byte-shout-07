-- إصلاح دالة extract_product_items_from_text لاستخدام base_price بدلاً من price

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(TEXT, UUID);

-- إعادة إنشاء الدالة بالتعديل الصحيح
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  p_text TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  color_id UUID,
  color_name TEXT,
  size_id UUID,
  size_name TEXT,
  quantity INTEGER,
  price NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_full_access BOOLEAN := FALSE;
  v_color_matches TEXT[];
  v_size_matches TEXT[];
  v_keywords TEXT[];
  v_keyword TEXT;
BEGIN
  -- التحقق من الصلاحيات الكاملة
  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions upp
    WHERE upp.user_id = p_user_id 
      AND upp.permission_type = 'products'
      AND upp.has_full_access = true
  ) INTO v_has_full_access;

  -- استخراج الألوان والأحجام من النص
  v_color_matches := regexp_matches(lower(p_text), '(ازرق|احمر|اسود|ابيض|اصفر|اخضر|برتقالي|بنفسجي|وردي|بني|رمادي|ذهبي|فضي)', 'g');
  v_size_matches := regexp_matches(upper(p_text), '(S|M|L|XL|XXL|XXXL|سمول|ميديوم|لارج)', 'g');

  -- استخراج كلمات البحث
  v_keywords := regexp_split_to_array(lower(trim(p_text)), '\s+');

  RETURN QUERY
  SELECT DISTINCT
    p.id as product_id,
    p.name as product_name,
    pv.color_id,
    c.name as color_name,
    pv.size_id,
    s.name as size_name,
    1 as quantity,
    COALESCE(pv.price, p.base_price) as price
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  WHERE p.is_active = true
    -- تطبيق صلاحيات المنتجات
    AND (
      v_has_full_access
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'products'
          AND upp.allowed_items @> jsonb_build_array(p.id::text)
      )
    )
    -- تطبيق صلاحيات الفئات
    AND (
      v_has_full_access
      OR p.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'categories'
          AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(p.category_id::text))
      )
    )
    -- تطبيق صلاحيات الأقسام
    AND (
      v_has_full_access
      OR p.department_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'departments'
          AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(p.department_id::text))
      )
    )
    -- تطبيق صلاحيات الألوان
    AND (
      v_has_full_access
      OR pv.color_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'colors'
          AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(pv.color_id::text))
      )
    )
    -- تطبيق صلاحيات الأحجام
    AND (
      v_has_full_access
      OR pv.size_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'sizes'
          AND (upp.has_full_access = true OR upp.allowed_items @> jsonb_build_array(pv.size_id::text))
      )
    )
    -- البحث في اسم المنتج
    AND (
      EXISTS (
        SELECT 1 FROM unnest(v_keywords) kw
        WHERE lower(p.name) LIKE '%' || kw || '%'
      )
    )
  ORDER BY p.name
  LIMIT 10;
END;
$$;