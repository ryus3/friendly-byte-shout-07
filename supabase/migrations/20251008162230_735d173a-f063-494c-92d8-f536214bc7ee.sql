-- Fix extract_product_items_from_text to use base_price instead of non-existent price column
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_text text;
  v_products jsonb := '[]'::jsonb;
  v_product record;
  v_color record;
  v_size record;
  v_variant record;
  v_item jsonb;
  v_quantity int := 1;
BEGIN
  RAISE NOTICE '🔍 Starting extraction for: %', input_text;
  
  v_text := lower(trim(input_text));
  RAISE NOTICE '📝 Normalized text: %', v_text;
  
  -- البحث عن المنتجات المطابقة
  FOR v_product IN
    SELECT 
      p.id,
      p.name,
      p.base_price,
      p.cost_price
    FROM products p
    WHERE p.is_active = true
      AND (
        lower(p.name) = ANY(string_to_array(v_text, ' '))
        OR v_text LIKE '%' || lower(p.name) || '%'
        OR lower(p.name) LIKE '%' || v_text || '%'
      )
    ORDER BY 
      CASE 
        WHEN lower(p.name) = v_text THEN 1
        WHEN v_text LIKE lower(p.name) || '%' THEN 2
        WHEN lower(p.name) LIKE v_text || '%' THEN 3
        ELSE 4
      END,
      length(p.name)
    LIMIT 5
  LOOP
    RAISE NOTICE '✅ Found product: % (ID: %)', v_product.name, v_product.id;
    
    -- تجميع معلومات المنتج الأساسية
    v_item := jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'price', v_product.base_price,
      'quantity', v_quantity,
      'color_id', null,
      'color_name', null,
      'size_id', null,
      'size_name', null,
      'variant_id', null
    );
    
    RAISE NOTICE '📦 Base item created: %', v_item;
    
    -- البحث عن اللون
    FOR v_color IN
      SELECT c.id, c.name
      FROM colors c
      WHERE lower(c.name) = ANY(string_to_array(v_text, ' '))
         OR v_text LIKE '%' || lower(c.name) || '%'
      LIMIT 1
    LOOP
      RAISE NOTICE '🎨 Found color: % (ID: %)', v_color.name, v_color.id;
      v_item := jsonb_set(v_item, '{color_id}', to_jsonb(v_color.id));
      v_item := jsonb_set(v_item, '{color_name}', to_jsonb(v_color.name));
    END LOOP;
    
    -- البحث عن القياس
    FOR v_size IN
      SELECT s.id, s.name
      FROM sizes s
      WHERE lower(s.name) = ANY(string_to_array(v_text, ' '))
         OR v_text LIKE '%' || lower(s.name) || '%'
      LIMIT 1
    LOOP
      RAISE NOTICE '📏 Found size: % (ID: %)', v_size.name, v_size.id;
      v_item := jsonb_set(v_item, '{size_id}', to_jsonb(v_size.id));
      v_item := jsonb_set(v_item, '{size_name}', to_jsonb(v_size.name));
    END LOOP;
    
    -- إذا وجدنا لون وقياس، نبحث عن variant محدد
    IF (v_item->>'color_id') IS NOT NULL AND (v_item->>'size_id') IS NOT NULL THEN
      RAISE NOTICE '🔎 Searching for variant: product=%, color=%, size=%', 
        v_product.id, v_item->>'color_id', v_item->>'size_id';
      
      FOR v_variant IN
        SELECT 
          pv.id,
          pv.price,
          pv.sku,
          i.quantity as stock_quantity
        FROM product_variants pv
        LEFT JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = v_product.id
          AND pv.color_id = (v_item->>'color_id')::uuid
          AND pv.size_id = (v_item->>'size_id')::uuid
        LIMIT 1
      LOOP
        RAISE NOTICE '✨ Found variant: ID=%, price=%, stock=%', 
          v_variant.id, v_variant.price, v_variant.stock_quantity;
        
        v_item := jsonb_set(v_item, '{variant_id}', to_jsonb(v_variant.id));
        v_item := jsonb_set(v_item, '{price}', to_jsonb(v_variant.price));
        v_item := jsonb_set(v_item, '{sku}', to_jsonb(v_variant.sku));
        v_item := jsonb_set(v_item, '{stock_quantity}', to_jsonb(COALESCE(v_variant.stock_quantity, 0)));
      END LOOP;
      
      IF (v_item->>'variant_id') IS NULL THEN
        RAISE NOTICE '⚠️ No variant found for this color/size combination';
      END IF;
    ELSE
      RAISE NOTICE '⚠️ Missing color or size - cannot find specific variant';
    END IF;
    
    -- إضافة العنصر إلى القائمة
    v_products := v_products || jsonb_build_array(v_item);
    RAISE NOTICE '➕ Item added to list. Total items: %', jsonb_array_length(v_products);
  END LOOP;
  
  RAISE NOTICE '🎯 Final result: % items extracted', jsonb_array_length(v_products);
  RAISE NOTICE '📋 Full result: %', v_products;
  
  RETURN v_products;
END;
$function$;