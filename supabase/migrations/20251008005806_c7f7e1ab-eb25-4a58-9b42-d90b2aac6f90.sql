-- تبسيط دالة extract_product_items_from_text - صلاحيات المنتجات فقط

DROP FUNCTION IF EXISTS public.extract_product_items_from_text(TEXT, UUID);

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
  v_keywords TEXT[];
BEGIN
  -- التحقق من الصلاحيات الكاملة للمنتجات فقط
  SELECT EXISTS (
    SELECT 1 FROM user_product_permissions upp
    WHERE upp.user_id = p_user_id 
      AND upp.permission_type = 'products'
      AND upp.has_full_access = true
  ) INTO v_has_full_access;

  -- استخراج كلمات البحث من النص
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
    -- فحص صلاحيات المنتجات فقط
    AND (
      v_has_full_access
      OR EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'products'
          AND upp.allowed_items @> jsonb_build_array(p.id::text)
      )
    )
    -- البحث في اسم المنتج
    AND EXISTS (
      SELECT 1 FROM unnest(v_keywords) kw
      WHERE lower(p.name) LIKE '%' || kw || '%'
    )
  ORDER BY p.name
  LIMIT 10;
END;
$$;