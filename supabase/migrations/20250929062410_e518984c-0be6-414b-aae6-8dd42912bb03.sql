-- تحسين دالة extract_product_items_from_text لفهم أفضل للمنتجات والأقسام
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_text text;
  product_items jsonb := '[]'::jsonb;
  words text[];
  i integer;
  current_word text;
  next_word text;
  quantity integer := 1;
  found_products text[] := '{}';
  product_record record;
  variant_record record;
  item_data jsonb;
  matched_color text;
  matched_size text;
  total_price numeric;
  unit_price numeric;
BEGIN
  -- تطبيع النص
  normalized_text := lower(trim(regexp_replace(input_text, E'[\r\n]+', ' ', 'g')));
  normalized_text := regexp_replace(normalized_text, E'\\s+', ' ', 'g');
  words := string_to_array(normalized_text, ' ');
  
  RAISE NOTICE '🔍 بدء تحليل النص للمنتجات: %', normalized_text;
  
  -- البحث عن المنتجات في النص
  FOR product_record IN 
    SELECT DISTINCT p.id, p.name, p.base_price, p.cost_price,
           d.name as department_name, c.name as category_name,
           pt.name as product_type_name, so.name as season_name
    FROM products p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_types pt ON p.product_type_id = pt.id
    LEFT JOIN seasons_occasions so ON p.season_occasion_id = so.id
    WHERE p.is_active = true
      AND (
        normalized_text LIKE '%' || lower(p.name) || '%'
        OR lower(p.name) LIKE '%' || normalized_text || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(words) as word
          WHERE lower(p.name) LIKE '%' || word || '%'
            AND length(word) >= 3
        )
      )
  LOOP
    RAISE NOTICE '🎯 تم العثور على منتج: %', product_record.name;
    
    -- البحث عن الكمية قريباً من اسم المنتج
    quantity := 1;
    FOR i IN 1..array_length(words, 1) LOOP
      IF words[i] ~ '^[0-9]+$' AND words[i]::integer > 0 AND words[i]::integer <= 100 THEN
        -- فحص إذا كان الرقم قريب من اسم المنتج
        FOR j IN GREATEST(1, i-3)..LEAST(array_length(words, 1), i+3) LOOP
          IF lower(product_record.name) LIKE '%' || words[j] || '%' THEN
            quantity := words[i]::integer;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
    
    -- البحث عن لون مناسب
    matched_color := NULL;
    SELECT co.name INTO matched_color
    FROM colors co
    WHERE normalized_text LIKE '%' || lower(co.name) || '%'
    LIMIT 1;
    
    -- البحث عن حجم مناسب
    matched_size := NULL;
    SELECT s.name INTO matched_size
    FROM sizes s
    WHERE normalized_text LIKE '%' || lower(s.name) || '%'
    LIMIT 1;
    
    -- البحث عن أفضل variant متاح
    SELECT pv.id, pv.sku, pv.price, pv.cost_price,
           COALESCE(co.name, 'افتراضي') as color_name,
           COALESCE(si.name, 'افتراضي') as size_name,
           COALESCE(inv.quantity, 0) as available_quantity
    INTO variant_record
    FROM product_variants pv
    LEFT JOIN colors co ON pv.color_id = co.id
    LEFT JOIN sizes si ON pv.size_id = si.id
    LEFT JOIN inventory inv ON pv.id = inv.variant_id
    WHERE pv.product_id = product_record.id
      AND (
        matched_color IS NULL OR lower(co.name) = lower(matched_color)
        OR matched_color IS NULL
      )
      AND (
        matched_size IS NULL OR lower(si.name) = lower(matched_size)
        OR matched_size IS NULL
      )
      AND COALESCE(inv.quantity, 0) > 0
    ORDER BY 
      CASE WHEN lower(co.name) = lower(COALESCE(matched_color, '')) THEN 1 ELSE 2 END,
      CASE WHEN lower(si.name) = lower(COALESCE(matched_size, '')) THEN 1 ELSE 2 END,
      inv.quantity DESC
    LIMIT 1;
    
    -- إذا لم نجد variant متاح، نأخذ أي variant
    IF variant_record.id IS NULL THEN
      SELECT pv.id, pv.sku, pv.price, pv.cost_price,
             COALESCE(co.name, 'افتراضي') as color_name,
             COALESCE(si.name, 'افتراضي') as size_name,
             COALESCE(inv.quantity, 0) as available_quantity
      INTO variant_record
      FROM product_variants pv
      LEFT JOIN colors co ON pv.color_id = co.id
      LEFT JOIN sizes si ON pv.size_id = si.id
      LEFT JOIN inventory inv ON pv.id = inv.variant_id
      WHERE pv.product_id = product_record.id
      ORDER BY inv.quantity DESC
      LIMIT 1;
    END IF;
    
    -- حساب السعر
    unit_price := COALESCE(variant_record.price, product_record.base_price, 0);
    total_price := unit_price * quantity;
    
    -- إنشاء عنصر المنتج
    item_data := jsonb_build_object(
      'product_id', product_record.id,
      'product_name', product_record.name,
      'variant_id', variant_record.id,
      'variant_sku', variant_record.sku,
      'quantity', quantity,
      'unit_price', unit_price,
      'total_price', total_price,
      'color', variant_record.color_name,
      'size', variant_record.size_name,
      'available_stock', variant_record.available_quantity,
      'department', product_record.department_name,
      'category', product_record.category_name,
      'product_type', product_record.product_type_name,
      'season', product_record.season_name,
      'stock_status', CASE 
        WHEN variant_record.available_quantity >= quantity THEN 'available'
        WHEN variant_record.available_quantity > 0 THEN 'limited'
        ELSE 'out_of_stock'
      END
    );
    
    product_items := product_items || jsonb_build_array(item_data);
    
    RAISE NOTICE '✅ تم إضافة منتج: % - الكمية: % - السعر: %', 
      product_record.name, quantity, total_price;
  END LOOP;
  
  RAISE NOTICE '📦 إجمالي المنتجات المستخرجة: %', jsonb_array_length(product_items);
  
  RETURN product_items;
END;
$function$;