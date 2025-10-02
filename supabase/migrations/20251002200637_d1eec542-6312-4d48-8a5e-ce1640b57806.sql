
-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS public.get_inventory_by_permissions(uuid, text, text);

-- إنشاء دالة جديدة مع فحص الأدوار أولاً (مبسطة حسب جدول products الفعلي)
CREATE OR REPLACE FUNCTION public.get_inventory_by_permissions(
  p_employee_id uuid,
  p_filter_type text DEFAULT 'all',
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  category_id uuid,
  category_name text,
  variants jsonb,
  total_quantity bigint,
  total_reserved bigint,
  total_available bigint,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean := false;
  v_has_view_all boolean := false;
  v_allowed_product_ids uuid[];
  v_allowed_category_ids uuid[];
BEGIN
  -- الخطوة 1: فحص إذا كان المستخدم admin/super_admin/deputy_admin
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_employee_id
      AND ur.is_active = true
      AND r.name IN ('admin', 'super_admin', 'deputy_admin')
  ) INTO v_is_admin;

  RAISE NOTICE '🔍 فحص الصلاحيات - المستخدم: %, هل مدير: %', p_employee_id, v_is_admin;

  -- إذا كان admin → إرجاع كل المنتجات
  IF v_is_admin THEN
    RAISE NOTICE '✅ المستخدم مدير - عرض جميع المنتجات';
    
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.name as product_name,
      p.category_id,
      c.name as category_name,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pv.id,
            'color_id', pv.color_id,
            'color_name', co.name,
            'size_id', pv.size_id,
            'size_name', s.name,
            'price', pv.price,
            'cost_price', pv.cost_price,
            'barcode', pv.barcode,
            'quantity', COALESCE(inv.quantity, 0),
            'reserved_quantity', COALESCE(inv.reserved_quantity, 0),
            'available_quantity', COALESCE(inv.quantity - inv.reserved_quantity, 0)
          ) ORDER BY co.name, s.name
        ) FILTER (WHERE pv.id IS NOT NULL),
        '[]'::jsonb
      ) as variants,
      COALESCE(SUM(inv.quantity), 0) as total_quantity,
      COALESCE(SUM(inv.reserved_quantity), 0) as total_reserved,
      COALESCE(SUM(inv.quantity - inv.reserved_quantity), 0) as total_available,
      p.is_active
    FROM public.products p
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.product_variants pv ON p.id = pv.product_id
    LEFT JOIN public.colors co ON pv.color_id = co.id
    LEFT JOIN public.sizes s ON pv.size_id = s.id
    LEFT JOIN public.inventory inv ON pv.id = inv.variant_id
    WHERE p.is_active = true
      AND (p_search_term IS NULL OR LOWER(p.name) LIKE '%' || LOWER(p_search_term) || '%')
    GROUP BY p.id, p.name, p.category_id, c.name, p.is_active
    ORDER BY p.name;
    
    RETURN;
  END IF;

  -- الخطوة 2: إذا لم يكن admin، فحص user_product_permissions
  RAISE NOTICE '⚠️ المستخدم ليس مديراً - فحص صلاحيات المنتجات';

  -- فحص إذا كان لديه صلاحية view_all
  SELECT EXISTS (
    SELECT 1
    FROM public.user_product_permissions upp
    JOIN public.permissions perm ON upp.permission_id = perm.id
    WHERE upp.user_id = p_employee_id
      AND upp.is_active = true
      AND perm.name = 'view_all_products'
  ) INTO v_has_view_all;

  IF v_has_view_all THEN
    RAISE NOTICE '✅ المستخدم لديه صلاحية view_all_products';
    
    RETURN QUERY
    SELECT 
      p.id, p.name, p.category_id, c.name,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', pv.id, 'color_id', pv.color_id, 'color_name', co.name,
        'size_id', pv.size_id, 'size_name', s.name, 'price', pv.price,
        'cost_price', pv.cost_price, 'barcode', pv.barcode,
        'quantity', COALESCE(inv.quantity, 0),
        'reserved_quantity', COALESCE(inv.reserved_quantity, 0),
        'available_quantity', COALESCE(inv.quantity - inv.reserved_quantity, 0)
      ) ORDER BY co.name, s.name) FILTER (WHERE pv.id IS NOT NULL), '[]'::jsonb),
      COALESCE(SUM(inv.quantity), 0),
      COALESCE(SUM(inv.reserved_quantity), 0),
      COALESCE(SUM(inv.quantity - inv.reserved_quantity), 0),
      p.is_active
    FROM public.products p
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.product_variants pv ON p.id = pv.product_id
    LEFT JOIN public.colors co ON pv.color_id = co.id
    LEFT JOIN public.sizes s ON pv.size_id = s.id
    LEFT JOIN public.inventory inv ON pv.id = inv.variant_id
    WHERE p.is_active = true
      AND (p_search_term IS NULL OR LOWER(p.name) LIKE '%' || LOWER(p_search_term) || '%')
    GROUP BY p.id, p.name, p.category_id, c.name, p.is_active
    ORDER BY p.name;
    RETURN;
  END IF;

  -- جمع المنتجات والفئات المسموحة
  SELECT 
    COALESCE(array_agg(DISTINCT upp.product_id) FILTER (WHERE upp.product_id IS NOT NULL), ARRAY[]::uuid[]),
    COALESCE(array_agg(DISTINCT upp.category_id) FILTER (WHERE upp.category_id IS NOT NULL), ARRAY[]::uuid[])
  INTO v_allowed_product_ids, v_allowed_category_ids
  FROM public.user_product_permissions upp
  WHERE upp.user_id = p_employee_id
    AND upp.is_active = true;

  RAISE NOTICE '📦 الصلاحيات: منتجات=%, فئات=%',
    array_length(v_allowed_product_ids, 1),
    array_length(v_allowed_category_ids, 1);

  -- إرجاع المنتجات حسب الصلاحيات
  RETURN QUERY
  SELECT 
    p.id, p.name, p.category_id, c.name,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', pv.id, 'color_id', pv.color_id, 'color_name', co.name,
      'size_id', pv.size_id, 'size_name', s.name, 'price', pv.price,
      'cost_price', pv.cost_price, 'barcode', pv.barcode,
      'quantity', COALESCE(inv.quantity, 0),
      'reserved_quantity', COALESCE(inv.reserved_quantity, 0),
      'available_quantity', COALESCE(inv.quantity - inv.reserved_quantity, 0)
    ) ORDER BY co.name, s.name) FILTER (WHERE pv.id IS NOT NULL), '[]'::jsonb),
    COALESCE(SUM(inv.quantity), 0),
    COALESCE(SUM(inv.reserved_quantity), 0),
    COALESCE(SUM(inv.quantity - inv.reserved_quantity), 0),
    p.is_active
  FROM public.products p
  LEFT JOIN public.categories c ON p.category_id = c.id
  LEFT JOIN public.product_variants pv ON p.id = pv.product_id
  LEFT JOIN public.colors co ON pv.color_id = co.id
  LEFT JOIN public.sizes s ON pv.size_id = s.id
  LEFT JOIN public.inventory inv ON pv.id = inv.variant_id
  WHERE p.is_active = true
    AND (p_search_term IS NULL OR LOWER(p.name) LIKE '%' || LOWER(p_search_term) || '%')
    AND (
      p.id = ANY(v_allowed_product_ids)
      OR p.category_id = ANY(v_allowed_category_ids)
    )
  GROUP BY p.id, p.name, p.category_id, c.name, p.is_active
  ORDER BY p.name;

END;
$$;

-- اختبار الدالة مع المستخدم super_admin
SELECT 
  product_name,
  category_name,
  total_quantity,
  total_available
FROM public.get_inventory_by_permissions(
  '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  'all',
  'برشلونة'
);
