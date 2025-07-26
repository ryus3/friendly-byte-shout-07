-- إصلاح وتحسين منطق تحليل جنس العملاء بناءً على التصنيفات الموجودة
CREATE OR REPLACE FUNCTION public.analyze_customer_gender(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  male_orders INTEGER := 0;
  female_orders INTEGER := 0;
  total_orders INTEGER := 0;
  gender_result TEXT := 'unisex';
BEGIN
  -- حساب الطلبات بناءً على التصنيفات البسيطة
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN c.name ILIKE '%رجال%' OR c.name ILIKE '%رجالي%' THEN 1 END) as male_count,
    COUNT(CASE WHEN c.name ILIKE '%نساء%' OR c.name ILIKE '%نسائي%' THEN 1 END) as female_count
  INTO total_orders, male_orders, female_orders
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN products p ON oi.product_id = p.id
  JOIN product_categories pc ON p.id = pc.product_id
  JOIN categories c ON pc.category_id = c.id
  WHERE o.customer_id = customer_id_param 
    AND o.status IN ('completed', 'delivered');
  
  -- تحديد الجنس بناءً على الأغلبية
  IF total_orders > 0 THEN
    IF male_orders > female_orders THEN
      gender_result := 'male';
    ELSIF female_orders > male_orders THEN
      gender_result := 'female';
    ELSE
      gender_result := 'unisex';
    END IF;
  END IF;
  
  -- حفظ النتيجة
  INSERT INTO customer_gender_segments (customer_id, gender_type, confidence_score)
  VALUES (customer_id_param, gender_result, 
    CASE 
      WHEN total_orders = 0 THEN 0.5
      ELSE GREATEST(male_orders, female_orders)::numeric / total_orders
    END)
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    gender_type = EXCLUDED.gender_type,
    confidence_score = EXCLUDED.confidence_score,
    last_analysis_date = now(),
    updated_at = now();
  
  RETURN gender_result;
END;
$$;

-- تحديث تحليل جنس العملاء الحاليين
UPDATE customer_gender_segments 
SET gender_type = 'unisex', confidence_score = 0.5
WHERE gender_type NOT IN ('male', 'female', 'unisex');

-- فهرسة لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_name_gender ON categories(name) WHERE name ILIKE '%رجال%' OR name ILIKE '%نساء%' OR name ILIKE '%رجالي%' OR name ILIKE '%نسائي%';
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON customer_loyalty(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_gender_segments_customer ON customer_gender_segments(customer_id);