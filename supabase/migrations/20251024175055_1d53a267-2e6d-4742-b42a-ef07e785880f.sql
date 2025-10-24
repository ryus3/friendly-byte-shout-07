-- Drop and recreate the function with enhanced size recognition
DROP FUNCTION IF EXISTS extract_product_items_from_text(text);

CREATE OR REPLACE FUNCTION extract_product_items_from_text(input_text text)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  color_name text,
  size_name text,
  quantity integer,
  unit_price numeric,
  available_quantity integer,
  reserved_quantity integer
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_line text;
  v_lines text[];
  v_word text;
  v_words text[];
  v_product_id uuid;
  v_product_name text;
  v_variant_id uuid;
  v_color_id uuid;
  v_color_name text;
  v_size_id uuid;
  v_size_name text;
  v_quantity integer := 1;
  v_unit_price numeric;
  v_available_quantity integer;
  v_reserved_quantity integer;
  v_found_color record;
  v_found_size record;
  v_best_match record;
  v_search_query text;
  v_matched_product_id uuid;
  v_matched_product_name text;
  v_similarity_threshold float := 0.3;
  v_best_similarity float := 0;
  v_current_similarity float;
  v_trigram_score float;
  v_bigram_score float;
  v_combined_score float;
BEGIN
  v_lines := string_to_array(input_text, E'\n');
  
  FOREACH v_line IN ARRAY v_lines
  LOOP
    CONTINUE WHEN trim(v_line) = '';
    
    v_product_id := NULL;
    v_product_name := NULL;
    v_variant_id := NULL;
    v_color_id := NULL;
    v_color_name := NULL;
    v_size_id := NULL;
    v_size_name := NULL;
    v_quantity := 1;
    v_unit_price := NULL;
    v_available_quantity := 0;
    v_reserved_quantity := 0;
    
    v_line := regexp_replace(v_line, '\s+', ' ', 'g');
    v_line := trim(v_line);
    
    v_words := string_to_array(lower(v_line), ' ');
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      v_word := trim(v_word);
      CONTINUE WHEN v_word = '';
      
      IF v_word ~ '^\d+$' THEN
        v_quantity := v_word::integer;
        CONTINUE;
      END IF;
      
      IF v_found_color IS NULL THEN
        SELECT c.id, c.name INTO v_found_color
        FROM colors c 
        WHERE lower(c.name) = v_word
           OR lower(c.name) LIKE '%' || v_word || '%'
        LIMIT 1;
        
        IF FOUND THEN
          v_color_id := v_found_color.id;
          v_color_name := v_found_color.name;
          CONTINUE;
        END IF;
      END IF;
      
      IF v_found_size IS NULL THEN
        SELECT s.id, s.name INTO v_found_size
        FROM sizes s 
        WHERE lower(s.name) = v_word
           -- S / سمول
           OR (v_word IN ('سمول', 'صغير') AND lower(s.name) = 's')
           -- M / ميديم
           OR (v_word IN ('ميديم', 'ميديوم', 'وسط') AND lower(s.name) = 'm')
           -- L / لارج
           OR (v_word IN ('لارج', 'كبير') AND lower(s.name) = 'l')
           -- XL / اكس
           OR (v_word IN ('اكس', 'اكس لارج') AND lower(s.name) = 'xl')
           -- XXL / اكسين
           OR (v_word IN ('اكسين', 'اكسين لارج', 'دبل اكس', '2xl', 'دبل') AND lower(s.name) = 'xxl')
           -- XXXL / ثلاثة اكسات
           OR (v_word IN ('ثلاث اكسات', 'ثلاثة اكس', 'ثلاثه اكس', '3xl') AND lower(s.name) = 'xxxl')
           OR lower(s.name) LIKE '%' || v_word || '%'
        LIMIT 1;
        
        IF FOUND THEN
          v_size_id := v_found_size.id;
          v_size_name := v_found_size.name;
          
          IF v_word IN ('ميديم', 'ميديوم', 'لارج', 'سمول', 'اكس', 'اكسين', 'دبل', 'دبل اكس', 'اكسين لارج', 'ثلاث اكسات', 'ثلاثة اكس', 'ثلاثه اكس', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl', 'xl', '3xl', '2xl') THEN
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    v_search_query := v_line;
    v_search_query := regexp_replace(v_search_query, '\d+', '', 'g');
    IF v_color_name IS NOT NULL THEN
      v_search_query := regexp_replace(v_search_query, v_color_name, '', 'gi');
    END IF;
    IF v_size_name IS NOT NULL THEN
      v_search_query := regexp_replace(v_search_query, v_size_name, '', 'gi');
    END IF;
    v_search_query := regexp_replace(v_search_query, '\s+', ' ', 'g');
    v_search_query := trim(v_search_query);
    
    v_best_similarity := 0;
    v_matched_product_id := NULL;
    v_matched_product_name := NULL;
    
    FOR v_best_match IN 
      SELECT 
        p.id,
        p.name,
        similarity(lower(p.name), lower(v_search_query)) as trigram_sim,
        (
          SELECT COUNT(*)::float / GREATEST(
            array_length(string_to_array(lower(p.name), ' '), 1),
            array_length(string_to_array(lower(v_search_query), ' '), 1)
          )
          FROM unnest(string_to_array(lower(p.name), ' ')) AS pword
          WHERE pword = ANY(string_to_array(lower(v_search_query), ' '))
        ) as bigram_sim
      FROM products p
      WHERE p.is_active = true
      ORDER BY trigram_sim DESC
      LIMIT 10
    LOOP
      v_trigram_score := COALESCE(v_best_match.trigram_sim, 0);
      v_bigram_score := COALESCE(v_best_match.bigram_sim, 0);
      v_combined_score := (v_trigram_score * 0.6) + (v_bigram_score * 0.4);
      
      IF v_combined_score > v_best_similarity THEN
        v_best_similarity := v_combined_score;
        v_matched_product_id := v_best_match.id;
        v_matched_product_name := v_best_match.name;
      END IF;
    END LOOP;
    
    IF v_matched_product_id IS NOT NULL AND v_best_similarity >= v_similarity_threshold THEN
      v_product_id := v_matched_product_id;
      v_product_name := v_matched_product_name;
    END IF;
    
    IF v_product_id IS NOT NULL THEN
      SELECT 
        pv.id,
        pv.price,
        COALESCE(i.quantity, 0),
        COALESCE(i.reserved_quantity, 0)
      INTO 
        v_variant_id,
        v_unit_price,
        v_available_quantity,
        v_reserved_quantity
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      ORDER BY 
        CASE WHEN pv.color_id = v_color_id AND pv.size_id = v_size_id THEN 1
             WHEN pv.color_id = v_color_id THEN 2
             WHEN pv.size_id = v_size_id THEN 3
             ELSE 4
        END
      LIMIT 1;
      
      IF v_variant_id IS NULL THEN
        SELECT 
          pv.id,
          pv.price,
          COALESCE(i.quantity, 0),
          COALESCE(i.reserved_quantity, 0)
        INTO 
          v_variant_id,
          v_unit_price,
          v_available_quantity,
          v_reserved_quantity
        FROM product_variants pv
        LEFT JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = v_product_id
        ORDER BY pv.created_at DESC
        LIMIT 1;
      END IF;
    END IF;
    
    product_id := v_product_id;
    product_name := v_product_name;
    variant_id := v_variant_id;
    color_name := v_color_name;
    size_name := v_size_name;
    quantity := v_quantity;
    unit_price := v_unit_price;
    available_quantity := v_available_quantity;
    reserved_quantity := v_reserved_quantity;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;