-- تعديل دالة process_telegram_order لحساب السعر الإجمالي بشكل صحيح
-- الآن v_calculated_amount يشمل رسوم التوصيل للمقارنة الصحيحة

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_user_id uuid DEFAULT NULL,
  p_region_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_calculated_amount numeric := 0;
  v_written_amount numeric;
  v_price_adjustment numeric := 0;
  v_adjustment_type text;
  v_delivery_fee numeric := 5000;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_notes text;
  v_items jsonb;
  v_region_name text;
  v_city_name text;
  v_final_amount numeric;
  v_discount numeric := 0;
BEGIN
  -- استخراج البيانات من p_order_data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_notes := p_order_data->>'notes';
  v_items := p_order_data->'items';
  v_delivery_fee := COALESCE((p_order_data->>'delivery_fee')::numeric, 5000);
  v_written_amount := NULLIF((p_order_data->>'written_total_amount')::numeric, 0);

  -- الحصول على اسم المنطقة والمدينة
  IF p_region_id IS NOT NULL THEN
    SELECT rc.name, cc.name 
    INTO v_region_name, v_city_name
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.id = p_region_id;
  END IF;

  v_customer_address := COALESCE(v_city_name, v_customer_city) || 
    CASE WHEN v_region_name IS NOT NULL THEN ', ' || v_region_name ELSE '' END ||
    CASE WHEN v_customer_address IS NOT NULL AND v_customer_address != 'لم يُحدد' 
      THEN ', ' || v_customer_address 
      ELSE '' 
    END;

  -- البحث عن أو إنشاء العميل
  SELECT id INTO v_customer_id
  FROM customers
  WHERE phone = v_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (name, phone, address, city, province, created_by)
    VALUES (
      COALESCE(v_customer_name, 'زبون تليغرام'),
      v_customer_phone,
      v_customer_address,
      COALESCE(v_city_name, v_customer_city),
      v_customer_province,
      COALESCE(p_user_id, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- حساب المبلغ الإجمالي المحسوب من المنتجات فقط أولاً
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    DECLARE
      v_product_name text := v_item->>'product_name';
      v_color text := v_item->>'color';
      v_size text := v_item->>'size';
      v_quantity integer := COALESCE((v_item->>'quantity')::integer, 1);
      v_price numeric;
    BEGIN
      -- البحث عن المنتج والنسخة
      SELECT pv.id, pv.product_id, COALESCE(pv.price, p.price, 0)
      INTO v_variant_id, v_product_id, v_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE LOWER(p.name) = LOWER(v_product_name)
        AND LOWER(c.name) = LOWER(v_color)
        AND LOWER(s.name) = LOWER(v_size)
      LIMIT 1;

      IF v_variant_id IS NULL THEN
        SELECT pv.id, pv.product_id, COALESCE(pv.price, p.price, 0)
        INTO v_variant_id, v_product_id, v_price
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE LOWER(p.name) = LOWER(v_product_name)
        LIMIT 1;
      END IF;

      v_calculated_amount := v_calculated_amount + (v_price * v_quantity);
    END;
  END LOOP;

  -- ✅ التعديل الرئيسي: إضافة رسوم التوصيل للمبلغ المحسوب
  v_calculated_amount := v_calculated_amount + v_delivery_fee;

  -- حساب التعديل على السعر
  IF v_written_amount IS NOT NULL AND v_written_amount > 0 THEN
    v_price_adjustment := v_written_amount - v_calculated_amount;
    
    IF v_price_adjustment < 0 THEN
      v_adjustment_type := 'خصم';
      v_discount := ABS(v_price_adjustment);
      v_final_amount := v_written_amount;
    ELSIF v_price_adjustment > 0 THEN
      v_adjustment_type := 'زيادة';
      v_final_amount := v_written_amount;
    ELSE
      v_adjustment_type := NULL;
      v_final_amount := v_calculated_amount;
    END IF;
  ELSE
    v_final_amount := v_calculated_amount;
    v_written_amount := v_calculated_amount;
  END IF;

  -- إنشاء الطلب
  INSERT INTO orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    final_amount,
    delivery_fee,
    discount,
    status,
    notes,
    created_by
  ) VALUES (
    v_customer_id,
    COALESCE(v_customer_name, 'زبون تليغرام'),
    v_customer_phone,
    v_customer_address,
    COALESCE(v_city_name, v_customer_city),
    v_customer_province,
    v_calculated_amount,
    v_final_amount,
    v_delivery_fee,
    v_discount,
    'pending',
    v_notes,
    COALESCE(p_user_id, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
  )
  RETURNING id INTO v_order_id;

  -- إضافة عناصر الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    DECLARE
      v_product_name text := v_item->>'product_name';
      v_color text := v_item->>'color';
      v_size text := v_item->>'size';
      v_quantity integer := COALESCE((v_item->>'quantity')::integer, 1);
      v_price numeric;
    BEGIN
      SELECT pv.id, pv.product_id, COALESCE(pv.price, p.price, 0)
      INTO v_variant_id, v_product_id, v_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE LOWER(p.name) = LOWER(v_product_name)
        AND LOWER(c.name) = LOWER(v_color)
        AND LOWER(s.name) = LOWER(v_size)
      LIMIT 1;

      IF v_variant_id IS NULL THEN
        SELECT pv.id, pv.product_id, COALESCE(pv.price, p.price, 0)
        INTO v_variant_id, v_product_id, v_price
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE LOWER(p.name) = LOWER(v_product_name)
        LIMIT 1;
      END IF;

      IF v_variant_id IS NOT NULL THEN
        INSERT INTO order_items (
          order_id,
          product_id,
          variant_id,
          quantity,
          price_at_time
        ) VALUES (
          v_order_id,
          v_product_id,
          v_variant_id,
          v_quantity,
          v_price
        );
      END IF;
    END;
  END LOOP;

  -- تحديث سجل ai_orders بمعرف الطلب
  UPDATE ai_orders
  SET related_order_id = v_order_id,
      status = 'processed',
      processed_at = now(),
      processed_by = p_user_id
  WHERE order_data = p_order_data;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_id', v_customer_id,
    'total_amount', v_final_amount,
    'adjustment_type', v_adjustment_type,
    'price_adjustment', v_price_adjustment
  );
END;
$function$;