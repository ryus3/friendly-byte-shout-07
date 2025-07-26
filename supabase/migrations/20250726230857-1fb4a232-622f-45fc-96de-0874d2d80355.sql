-- إصلاح دالة البروموكود وإكمال النظام

-- 7. دالة لإنشاء البروموكود التلقائي (مصححة)
CREATE OR REPLACE FUNCTION public.generate_customer_promo_code(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_phone TEXT;
  tier_name TEXT;
  generated_promo_code TEXT;
BEGIN
  -- جلب بيانات العميل
  SELECT c.phone, COALESCE(lt.name_en, 'NORM') INTO customer_phone, tier_name
  FROM customers c
  LEFT JOIN customer_loyalty cl ON c.id = cl.customer_id
  LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
  WHERE c.id = customer_id_param;
  
  -- إنشاء البروموكود
  IF customer_phone IS NOT NULL THEN
    generated_promo_code := 'RY' || RIGHT(customer_phone, 4) || UPPER(LEFT(tier_name, 2));
  ELSE
    generated_promo_code := 'RY' || UPPER(LEFT(customer_id_param::TEXT, 6));
  END IF;
  
  -- التأكد من عدم التكرار
  WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE customer_promo_codes.promo_code = generated_promo_code) LOOP
    generated_promo_code := generated_promo_code || FLOOR(RANDOM() * 10)::TEXT;
  END LOOP;
  
  RETURN generated_promo_code;
END;
$$;

-- 8. دالة لتحليل جنس العميل بناءً على مشترياته (محسنة)
CREATE OR REPLACE FUNCTION public.analyze_customer_gender(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  male_score NUMERIC := 0;
  female_score NUMERIC := 0;
  total_orders INTEGER := 0;
  gender_result TEXT := 'unisex';
BEGIN
  -- حساب النقاط بناءً على المشتريات
  SELECT 
    COUNT(*) as total,
    COALESCE(SUM(CASE WHEN pgc.gender_type = 'male' THEN pgc.priority ELSE 0 END), 0) as male_points,
    COALESCE(SUM(CASE WHEN pgc.gender_type = 'female' THEN pgc.priority ELSE 0 END), 0) as female_points
  INTO total_orders, male_score, female_score
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN products p ON oi.product_id = p.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN product_gender_categories pgc ON pc.category_id = pgc.category_id
  WHERE o.customer_id = customer_id_param 
    AND o.status IN ('completed', 'delivered');
  
  -- تحديد الجنس
  IF total_orders > 0 THEN
    IF male_score > female_score * 1.5 THEN
      gender_result := 'male';
    ELSIF female_score > male_score * 1.5 THEN
      gender_result := 'female';
    ELSE
      gender_result := 'unisex';
    END IF;
  END IF;
  
  -- حفظ النتيجة
  INSERT INTO customer_gender_segments (customer_id, gender_type, confidence_score)
  VALUES (customer_id_param, gender_result, GREATEST(male_score, female_score) / (male_score + female_score + 1))
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    gender_type = EXCLUDED.gender_type,
    confidence_score = EXCLUDED.confidence_score,
    last_analysis_date = now(),
    updated_at = now();
  
  RETURN gender_result;
END;
$$;

-- 9. دالة للتحقق من البروموكود وتطبيق الخصم (محسنة)
CREATE OR REPLACE FUNCTION public.validate_promo_code(promo_code_param TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  promo_record RECORD;
  result JSON;
BEGIN
  -- البحث عن البروموكود
  SELECT cpc.*, c.name as customer_name, lt.discount_percentage, lt.name as tier_name
  INTO promo_record
  FROM customer_promo_codes cpc
  JOIN customers c ON cpc.customer_id = c.id
  LEFT JOIN loyalty_tiers lt ON cpc.tier_id = lt.id
  WHERE cpc.promo_code = promo_code_param 
    AND cpc.is_active = true 
    AND cpc.used_count < cpc.max_uses;
  
  IF promo_record IS NULL THEN
    result := json_build_object(
      'valid', false,
      'message', 'برومو كود غير صالح أو منتهي الصلاحية'
    );
  ELSE
    result := json_build_object(
      'valid', true,
      'customer_id', promo_record.customer_id,
      'customer_name', promo_record.customer_name,
      'discount_percentage', promo_record.discount_percentage,
      'tier_name', promo_record.tier_name,
      'message', 'برومو كود صالح - خصم ' || promo_record.discount_percentage || '%'
    );
  END IF;
  
  RETURN result;
END;
$$;

-- 10. إدراج تصنيفات المنتجات الافتراضية (رجالي/نسائي)
INSERT INTO product_gender_categories (category_id, gender_type, priority)
SELECT id, 'male', 3 FROM categories WHERE name ILIKE '%رجال%' OR name ILIKE '%شباب%'
ON CONFLICT DO NOTHING;

INSERT INTO product_gender_categories (category_id, gender_type, priority)
SELECT id, 'female', 3 FROM categories WHERE name ILIKE '%نساء%' OR name ILIKE '%بنات%' OR name ILIKE '%سيدات%'
ON CONFLICT DO NOTHING;

-- 11. تحديث صلاحية النقاط للعملاء الحاليين
UPDATE customer_loyalty 
SET points_expiry_date = (last_tier_upgrade + INTERVAL '3 months')
WHERE points_expiry_date IS NULL AND last_tier_upgrade IS NOT NULL;

-- 12. إنشاء البروموكود للعملاء الحاليين
INSERT INTO customer_promo_codes (customer_id, promo_code, tier_id, discount_percentage)
SELECT 
  cl.customer_id,
  generate_customer_promo_code(cl.customer_id),
  cl.current_tier_id,
  COALESCE(lt.discount_percentage, 0)
FROM customer_loyalty cl
LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_promo_codes cpc WHERE cpc.customer_id = cl.customer_id
);

-- 13. تحليل جنس العملاء الحاليين
INSERT INTO customer_gender_segments (customer_id, gender_type, confidence_score)
SELECT c.id, 'unisex', 0.5
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_gender_segments cgs WHERE cgs.customer_id = c.id
);

-- 14. دالة لاستخدام البروموكود
CREATE OR REPLACE FUNCTION public.use_promo_code(promo_code_param TEXT, order_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_result JSON;
  promo_record RECORD;
BEGIN
  -- التحقق من صحة البروموكود
  SELECT validate_promo_code(promo_code_param) INTO validation_result;
  
  IF (validation_result->>'valid')::boolean = false THEN
    RETURN validation_result;
  END IF;
  
  -- تحديث عداد الاستخدام
  UPDATE customer_promo_codes 
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE promo_code = promo_code_param;
  
  -- تسجيل استخدام الخصم
  PERFORM record_discount_usage(
    (validation_result->>'customer_id')::UUID,
    'promo_code',
    (validation_result->>'discount_percentage')::NUMERIC,
    order_id_param
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم تطبيق البروموكود بنجاح',
    'discount_percentage', validation_result->>'discount_percentage',
    'customer_name', validation_result->>'customer_name'
  );
END;
$$;