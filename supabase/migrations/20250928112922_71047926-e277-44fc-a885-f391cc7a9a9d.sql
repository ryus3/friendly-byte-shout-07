-- تحسين دالة استخراج المنتجات لتعطي بيانات أدق عن الألوان والأحجام المتوفرة
CREATE OR REPLACE FUNCTION public.get_product_available_variants(p_product_id uuid, p_requested_color text DEFAULT NULL, p_requested_size text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_available_variants jsonb := '{}';
  v_colors_with_sizes jsonb := '{}';
  v_variant record;
  v_color_name text;
  v_size_name text;
  v_current_sizes text[];
BEGIN
  -- الحصول على جميع المتغيرات المتوفرة للمنتج مع المخزون
  FOR v_variant IN
    SELECT pv.id, c.name as color_name, s.name as size_name, 
           COALESCE(i.quantity, 0) as stock_quantity,
           pv.base_price
    FROM product_variants pv
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.product_id = p_product_id
      AND pv.is_active = true
      AND COALESCE(i.quantity, 0) > 0
    ORDER BY c.name, s.name
  LOOP
    v_color_name := COALESCE(v_variant.color_name, 'افتراضي');
    v_size_name := COALESCE(v_variant.size_name, 'افتراضي');
    
    -- إضافة الحجم للون
    IF v_colors_with_sizes ? v_color_name THEN
      v_current_sizes := ARRAY(SELECT jsonb_array_elements_text(v_colors_with_sizes->v_color_name));
      IF NOT (v_size_name = ANY(v_current_sizes)) THEN
        v_current_sizes := v_current_sizes || v_size_name;
        v_colors_with_sizes := jsonb_set(v_colors_with_sizes, ARRAY[v_color_name], to_jsonb(v_current_sizes));
      END IF;
    ELSE
      v_colors_with_sizes := jsonb_set(v_colors_with_sizes, ARRAY[v_color_name], to_jsonb(ARRAY[v_size_name]));
    END IF;
  END LOOP;
  
  -- تحديد حالة التوفر
  DECLARE
    v_is_available boolean := false;
    v_stock_status text := '';
    v_alternatives_message text := '';
    v_variant_found record;
  BEGIN
    -- التحقق من توفر المتغير المطلوب
    IF p_requested_color IS NOT NULL AND p_requested_size IS NOT NULL THEN
      SELECT pv.id, c.name as color_name, s.name as size_name, 
             COALESCE(i.quantity, 0) as stock_quantity
      INTO v_variant_found
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = p_product_id
        AND pv.is_active = true
        AND lower(c.name) = lower(p_requested_color)
        AND lower(s.name) = lower(p_requested_size);
      
      IF v_variant_found.id IS NOT NULL AND v_variant_found.stock_quantity > 0 THEN
        v_is_available := true;
        v_stock_status := '✅ متوفر في المخزون (' || v_variant_found.stock_quantity || ' قطعة)';
      ELSE
        v_stock_status := '❌ المواصفات المطلوبة غير متوفرة';
      END IF;
    ELSE
      v_stock_status := '⚠️ يرجى تحديد اللون والحجم';
    END IF;
    
    -- بناء رسالة البدائل
    IF jsonb_object_keys(v_colors_with_sizes) IS NOT NULL THEN
      v_alternatives_message := '';
      FOR v_color_name IN SELECT jsonb_object_keys(v_colors_with_sizes) ORDER BY v_color_name
      LOOP
        IF v_alternatives_message != '' THEN
          v_alternatives_message := v_alternatives_message || ', ';
        END IF;
        v_current_sizes := ARRAY(SELECT jsonb_array_elements_text(v_colors_with_sizes->v_color_name) ORDER BY 1);
        v_alternatives_message := v_alternatives_message || v_color_name || ' (' || array_to_string(v_current_sizes, ', ') || ')';
      END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
      'is_available', v_is_available,
      'stock_status', v_stock_status,
      'colors_with_sizes', v_colors_with_sizes,
      'alternatives_message', v_alternatives_message,
      'available_colors', ARRAY(SELECT jsonb_object_keys(v_colors_with_sizes)),
      'selection_needed', (p_requested_color IS NULL OR p_requested_size IS NULL OR NOT v_is_available)
    );
  END;
END;
$$;