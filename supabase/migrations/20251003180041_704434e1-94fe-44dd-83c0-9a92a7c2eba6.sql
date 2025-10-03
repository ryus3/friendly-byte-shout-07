-- إصلاح دالة get_inventory_by_permissions - إزالة الشرط الخاطئ is_active
DROP FUNCTION IF EXISTS get_inventory_by_permissions(uuid);

CREATE OR REPLACE FUNCTION get_inventory_by_permissions(p_user_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  quantity integer,
  reserved_quantity integer,
  available_quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- المديرون يرون كل المنتجات
  IF is_admin_or_deputy() THEN
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      c.name as color_name,
      s.name as size_name,
      COALESCE(i.quantity, 0) as quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_quantity
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;

  -- الموظفون يرون المنتجات حسب صلاحياتهم
  RETURN QUERY
  SELECT DISTINCT
    p.id as product_id,
    p.name as product_name,
    pv.id as variant_id,
    c.name as color_name,
    s.name as size_name,
    COALESCE(i.quantity, 0) as quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_quantity
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    AND (
      -- صلاحية المنتج المباشر
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'product'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.id::text])
      )
      OR
      -- صلاحية التصنيف
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'category'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.category_id::text])
      )
      OR
      -- صلاحية القسم
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'department'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.department_id::text])
      )
      OR
      -- صلاحية نوع المنتج
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'product_type'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.product_type_id::text])
      )
      OR
      -- صلاحية الموسم
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_user_id
          AND upp.permission_type = 'season'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.season_id::text])
      )
    )
    AND (
      pv.id IS NULL
      OR
      -- صلاحية اللون
      (
        c.id IS NULL
        OR
        EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_user_id
            AND upp.permission_type = 'color'
            AND upp.allowed_items @> to_jsonb(ARRAY[c.id::text])
        )
        OR
        NOT EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_user_id
            AND upp.permission_type = 'color'
        )
      )
      AND
      -- صلاحية الحجم
      (
        s.id IS NULL
        OR
        EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_user_id
            AND upp.permission_type = 'size'
            AND upp.allowed_items @> to_jsonb(ARRAY[s.id::text])
        )
        OR
        NOT EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_user_id
            AND upp.permission_type = 'size'
        )
      )
    )
  ORDER BY p.name, c.name, s.name;
END;
$$;