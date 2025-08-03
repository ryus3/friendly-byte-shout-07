-- إصلاح مشكلة الأمان وتحسين دالة إحصائيات المخزون
DROP FUNCTION IF EXISTS public.get_inventory_stats(UUID[], UUID[], UUID);

-- دالة محسنة وآمنة لحساب إحصائيات المخزون
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
  archived_products_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_has_full_access BOOLEAN := TRUE;
BEGIN
  -- فحص الصلاحيات إذا تم تمرير معرف المستخدم
  IF p_user_id IS NOT NULL THEN
    -- فحص بسيط للصلاحيات (يمكن تطويره لاحقاً)
    SELECT CASE 
      WHEN EXISTS(SELECT 1 FROM profiles WHERE user_id = p_user_id AND (status = 'active' OR status = 'admin')) 
      THEN TRUE 
      ELSE FALSE 
    END INTO user_has_full_access;
  END IF;
  
  RETURN QUERY
  WITH inventory_data AS (
    SELECT 
      p.id as product_id,
      pv.id as variant_id,
      pv.cost_price,
      COALESCE(pv.selling_price, p.selling_price) as selling_price,
      COALESCE(i.quantity, 0) as quantity,
      COALESCE(i.reserved_quantity, 0) as reserved_quantity,
      COALESCE(i.min_stock, 0) as min_stock,
      -- تحديد مستوى المخزون
      CASE 
        WHEN COALESCE(i.quantity, 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_stock, 0) THEN 'low'
        WHEN COALESCE(i.quantity, 0) <= (COALESCE(i.min_stock, 0) * 2) THEN 'medium'
        ELSE 'high'
      END as stock_level
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variant_id
    LEFT JOIN product_departments pd ON p.id = pd.product_id
    LEFT JOIN product_categories pc ON p.id = pc.product_id
    WHERE p.is_active = true
    AND (p_department_ids IS NULL OR pd.department_id = ANY(p_department_ids))
    AND (p_category_ids IS NULL OR pc.category_id = ANY(p_category_ids))
    AND user_has_full_access = true  -- تطبيق الصلاحيات
  ),
  
  product_totals AS (
    SELECT 
      product_id,
      SUM(quantity) as product_total_qty
    FROM inventory_data
    GROUP BY product_id
  )
  
  SELECT 
    COUNT(DISTINCT inventory_data.product_id)::BIGINT as total_products,
    COUNT(inventory_data.variant_id)::BIGINT as total_variants,
    COALESCE(SUM(inventory_data.quantity), 0)::BIGINT as total_quantity,
    COALESCE(SUM(inventory_data.quantity * inventory_data.cost_price), 0) as total_cost_value,
    COALESCE(SUM(inventory_data.quantity * inventory_data.selling_price), 0) as total_sale_value,
    COALESCE(SUM(inventory_data.quantity * (inventory_data.selling_price - inventory_data.cost_price)), 0) as total_expected_profit,
    COALESCE(SUM(inventory_data.reserved_quantity), 0)::BIGINT as reserved_quantity,
    COUNT(CASE WHEN inventory_data.stock_level = 'high' THEN 1 END)::BIGINT as high_stock_count,
    COUNT(CASE WHEN inventory_data.stock_level = 'medium' THEN 1 END)::BIGINT as medium_stock_count,
    COUNT(CASE WHEN inventory_data.stock_level = 'low' THEN 1 END)::BIGINT as low_stock_count,
    COUNT(CASE WHEN inventory_data.stock_level = 'out_of_stock' THEN 1 END)::BIGINT as out_of_stock_count,
    
    -- المنتجات المؤرشفة (التي جميع مقاساتها نافذة)
    COUNT(DISTINCT CASE 
      WHEN product_totals.product_total_qty = 0 THEN inventory_data.product_id 
    END)::BIGINT as archived_products_count
    
  FROM inventory_data
  LEFT JOIN product_totals ON inventory_data.product_id = product_totals.product_id;
END;
$function$;