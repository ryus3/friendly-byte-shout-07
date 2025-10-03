-- ======================================
-- إصلاح جذري لدالة get_inventory_by_permissions
-- ======================================

-- 1️⃣ حذف جميع النسخ القديمة من الدالة
DROP FUNCTION IF EXISTS get_inventory_by_permissions(uuid);
DROP FUNCTION IF EXISTS get_inventory_by_permissions(uuid, text, text);

-- 2️⃣ إنشاء النسخة الصحيحة النهائية (3 معاملات)
CREATE OR REPLACE FUNCTION get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT NULL,
  p_filter_value text DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  barcode text,
  price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ✅ المديرون يرون كل المنتجات (بدون أي فلترة)
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
      COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_quantity,
      pv.barcode,
      pv.price
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE p.is_active = true
      AND (p_filter_type IS NULL OR
           (p_filter_type = 'product' AND p.id::text = p_filter_value) OR
           (p_filter_type = 'category' AND p.category_id::text = p_filter_value) OR
           (p_filter_type = 'color' AND pv.color_id::text = p_filter_value) OR
           (p_filter_type = 'size' AND pv.size_id::text = p_filter_value))
    ORDER BY p.name, c.name, s.name;
    RETURN;
  END IF;

  -- ✅ الموظفون يرون المنتجات حسب صلاحياتهم
  RETURN QUERY
  SELECT DISTINCT
    p.id as product_id,
    p.name as product_name,
    pv.id as variant_id,
    c.name as color_name,
    s.name as size_name,
    COALESCE(i.quantity, 0) as quantity,
    COALESCE(i.reserved_quantity, 0) as reserved_quantity,
    COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_quantity,
    pv.barcode,
    pv.price
  FROM products p
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE p.is_active = true
    -- ⚠️ بدون شرط upp.is_active (هذا كان السبب في المشكلة!)
    AND (
      -- صلاحية المنتج المباشر
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'product'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.id::text])
      )
      OR
      -- صلاحية التصنيف
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'category'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.category_id::text])
      )
      OR
      -- صلاحية القسم
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'department'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.department_id::text])
      )
      OR
      -- صلاحية نوع المنتج
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
          AND upp.permission_type = 'product_type'
          AND upp.allowed_items @> to_jsonb(ARRAY[p.product_type_id::text])
      )
      OR
      -- صلاحية الموسم
      EXISTS (
        SELECT 1 FROM user_product_permissions upp
        WHERE upp.user_id = p_employee_id
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
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'color'
            AND upp.allowed_items @> to_jsonb(ARRAY[c.id::text])
        )
        OR
        NOT EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
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
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'size'
            AND upp.allowed_items @> to_jsonb(ARRAY[s.id::text])
        )
        OR
        NOT EXISTS (
          SELECT 1 FROM user_product_permissions upp
          WHERE upp.user_id = p_employee_id
            AND upp.permission_type = 'size'
        )
      )
    )
    AND (p_filter_type IS NULL OR
         (p_filter_type = 'product' AND p.id::text = p_filter_value) OR
         (p_filter_type = 'category' AND p.category_id::text = p_filter_value) OR
         (p_filter_type = 'color' AND pv.color_id::text = p_filter_value) OR
         (p_filter_type = 'size' AND pv.size_id::text = p_filter_value))
  ORDER BY p.name, c.name, s.name;
END;
$$;

-- 3️⃣ تعليق توضيحي
COMMENT ON FUNCTION get_inventory_by_permissions(uuid, text, text) IS 
'دالة جرد المنتجات حسب صلاحيات المستخدم - تم إصلاحها جذرياً بإزالة شرط upp.is_active';