-- إنشاء نظام إحصائيات المخزون الموحد والقوي

-- دالة شاملة لحساب جميع إحصائيات المخزون
CREATE OR REPLACE FUNCTION public.get_inventory_stats(
  p_department_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_products BIGINT,
  total_variants BIGINT,
  total_quantity BIGINT,
  total_cost_value NUMERIC,
  total_sale_value NUMERIC,
  total_expected_profit NUMERIC,
  reserved_quantity BIGINT,
  high_stock_count BIGINT,
  medium_stock_count BIGINT,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT,
  archived_products_count BIGINT,
  products_with_variants JSONB,
  stock_levels_breakdown JSONB,
  department_breakdown JSONB,
  category_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_has_full_access BOOLEAN := FALSE;
  allowed_dept_ids UUID[];
  allowed_cat_ids UUID[];
BEGIN
  -- فحص صلاحيات المستخدم
  IF p_user_id IS NOT NULL THEN
    SELECT has_full_access INTO user_has_full_access
    FROM public.get_user_allowed_filters(p_user_id);
    
    IF NOT user_has_full_access THEN
      -- جلب الأقسام والفئات المسموحة
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(allowed_departments->'ids')::UUID
      ) INTO allowed_dept_ids
      FROM public.get_user_allowed_filters(p_user_id);
      
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(allowed_categories->'ids')::UUID  
      ) INTO allowed_cat_ids
      FROM public.get_user_allowed_filters(p_user_id);
    END IF;
  END IF;
  
  RETURN QUERY
  WITH inventory_base AS (
    SELECT 
      p.id as product_id,
      p.name as product_name,
      p.selling_price,
      pv.id as variant_id,
      pv.cost_price,
      pv.selling_price as variant_selling_price,
      i.quantity,
      i.reserved_quantity,
      i.min_stock,
      d.id as department_id,
      d.name as department_name,
      c.id as category_id,
      c.name as category_name,
      -- تحديد مستوى المخزون
      CASE 
        WHEN i.quantity = 0 THEN 'out_of_stock'
        WHEN i.quantity <= i.min_stock THEN 'low'
        WHEN i.quantity <= (i.min_stock * 2) THEN 'medium'
        ELSE 'high'
      END as stock_level
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variant_id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    LEFT JOIN departments d ON pd.department_id = d.id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    LEFT JOIN categories c ON pc.category_id = c.id
    WHERE p.is_active = true
    AND (p_department_ids IS NULL OR d.id = ANY(p_department_ids))
    AND (p_category_ids IS NULL OR c.id = ANY(p_category_ids))
    -- تطبيق صلاحيات المستخدم
    AND (user_has_full_access OR allowed_dept_ids IS NULL OR d.id = ANY(allowed_dept_ids))
    AND (user_has_full_access OR allowed_cat_ids IS NULL OR c.id = ANY(allowed_cat_ids))
  ),
  
  aggregated_stats AS (
    SELECT
      COUNT(DISTINCT product_id) as total_products,
      COUNT(variant_id) as total_variants,
      COALESCE(SUM(quantity), 0) as total_quantity,
      COALESCE(SUM(quantity * cost_price), 0) as total_cost_value,
      COALESCE(SUM(quantity * COALESCE(variant_selling_price, selling_price)), 0) as total_sale_value,
      COALESCE(SUM(quantity * (COALESCE(variant_selling_price, selling_price) - cost_price)), 0) as total_expected_profit,
      COALESCE(SUM(reserved_quantity), 0) as reserved_quantity,
      COUNT(CASE WHEN stock_level = 'high' THEN 1 END) as high_stock_count,
      COUNT(CASE WHEN stock_level = 'medium' THEN 1 END) as medium_stock_count,
      COUNT(CASE WHEN stock_level = 'low' THEN 1 END) as low_stock_count,
      COUNT(CASE WHEN stock_level = 'out_of_stock' THEN 1 END) as out_of_stock_count,
      
      -- المنتجات المؤرشفة (جميع المقاسات نافذة)
      COUNT(DISTINCT CASE 
        WHEN product_id IN (
          SELECT product_id 
          FROM inventory_base ib2 
          WHERE ib2.product_id = inventory_base.product_id 
          GROUP BY product_id 
          HAVING COUNT(variant_id) > 0 AND SUM(quantity) = 0
        ) THEN product_id 
      END) as archived_products_count,
      
      -- تفصيل حسب القسم
      jsonb_object_agg(
        DISTINCT department_name,
        jsonb_build_object(
          'department_id', department_id,
          'products_count', COUNT(DISTINCT product_id) OVER (PARTITION BY department_id),
          'variants_count', COUNT(variant_id) OVER (PARTITION BY department_id),
          'total_quantity', SUM(quantity) OVER (PARTITION BY department_id)
        )
      ) FILTER (WHERE department_name IS NOT NULL) as department_breakdown,
      
      -- تفصيل حسب الفئة  
      jsonb_object_agg(
        DISTINCT category_name,
        jsonb_build_object(
          'category_id', category_id,
          'products_count', COUNT(DISTINCT product_id) OVER (PARTITION BY category_id),
          'variants_count', COUNT(variant_id) OVER (PARTITION BY category_id),
          'total_quantity', SUM(quantity) OVER (PARTITION BY category_id)
        )
      ) FILTER (WHERE category_name IS NOT NULL) as category_breakdown
      
    FROM inventory_base
  )
  
  SELECT 
    agg.total_products,
    agg.total_variants,
    agg.total_quantity,
    agg.total_cost_value,
    agg.total_sale_value,
    agg.total_expected_profit,
    agg.reserved_quantity,
    agg.high_stock_count,
    agg.medium_stock_count,
    agg.low_stock_count,
    agg.out_of_stock_count,
    agg.archived_products_count,
    
    -- منتجات مع تفاصيل المقاسات (للعرض المفصل)
    jsonb_agg(
      jsonb_build_object(
        'product_id', ib.product_id,
        'product_name', ib.product_name,
        'variant_id', ib.variant_id,
        'quantity', ib.quantity,
        'reserved_quantity', ib.reserved_quantity,
        'stock_level', ib.stock_level,
        'cost_value', ib.quantity * ib.cost_price,
        'sale_value', ib.quantity * COALESCE(ib.variant_selling_price, ib.selling_price)
      )
    ) as products_with_variants,
    
    -- تفصيل مستويات المخزون
    jsonb_build_object(
      'high', agg.high_stock_count,
      'medium', agg.medium_stock_count, 
      'low', agg.low_stock_count,
      'out_of_stock', agg.out_of_stock_count
    ) as stock_levels_breakdown,
    
    agg.department_breakdown,
    agg.category_breakdown
    
  FROM aggregated_stats agg, inventory_base ib
  GROUP BY 
    agg.total_products, agg.total_variants, agg.total_quantity,
    agg.total_cost_value, agg.total_sale_value, agg.total_expected_profit,
    agg.reserved_quantity, agg.high_stock_count, agg.medium_stock_count,
    agg.low_stock_count, agg.out_of_stock_count, agg.archived_products_count,
    agg.department_breakdown, agg.category_breakdown;
END;
$function$;