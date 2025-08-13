-- دالة لتحديث تصنيف جنس العملاء تلقائياً بناءً على مشترياتهم
CREATE OR REPLACE FUNCTION update_customer_gender_classification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_record RECORD;
  male_products_count INTEGER;
  female_products_count INTEGER;
  determined_gender TEXT;
  confidence NUMERIC;
BEGIN
  -- التكرار عبر جميع العملاء الذين لديهم طلبات
  FOR customer_record IN 
    SELECT DISTINCT c.id, c.phone
    FROM customers c
    JOIN orders o ON (
      (c.phone = o.customer_phone AND c.phone IS NOT NULL) OR
      c.id = o.customer_id
    )
    WHERE o.status IN ('completed', 'delivered') 
    AND o.receipt_received = true
  LOOP
    
    male_products_count := 0;
    female_products_count := 0;
    
    -- حساب عدد المنتجات الرجالية والنسائية لهذا العميل
    SELECT 
      COALESCE(SUM(CASE 
        WHEN EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.category_id IN (
            SELECT pc.category_id FROM product_categories pc WHERE pc.product_id = oi.product_id
          ) AND pgc.gender_type = 'male'
        ) OR EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.department_id IN (
            SELECT pd.department_id FROM product_departments pd WHERE pd.product_id = oi.product_id
          ) AND pgc.gender_type = 'male'
        ) OR EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.product_type_id IN (
            SELECT ppt.product_type_id FROM product_product_types ppt WHERE ppt.product_id = oi.product_id
          ) AND pgc.gender_type = 'male'
        ) THEN oi.quantity ELSE 0 END
      ), 0),
      COALESCE(SUM(CASE 
        WHEN EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.category_id IN (
            SELECT pc.category_id FROM product_categories pc WHERE pc.product_id = oi.product_id
          ) AND pgc.gender_type = 'female'
        ) OR EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.department_id IN (
            SELECT pd.department_id FROM product_departments pd WHERE pd.product_id = oi.product_id
          ) AND pgc.gender_type = 'female'
        ) OR EXISTS (
          SELECT 1 FROM product_gender_categories pgc 
          WHERE pgc.product_type_id IN (
            SELECT ppt.product_type_id FROM product_product_types ppt WHERE ppt.product_id = oi.product_id
          ) AND pgc.gender_type = 'female'
        ) THEN oi.quantity ELSE 0 END
      ), 0)
    INTO male_products_count, female_products_count
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status IN ('completed', 'delivered') 
    AND o.receipt_received = true
    AND (
      (customer_record.phone = o.customer_phone AND customer_record.phone IS NOT NULL) OR
      customer_record.id = o.customer_id
    );
    
    -- تحديد الجنس بناءً على الكمية الأكبر
    IF male_products_count > 0 OR female_products_count > 0 THEN
      IF male_products_count >= female_products_count THEN
        determined_gender := 'male';
      ELSE
        determined_gender := 'female';
      END IF;
      
      -- حساب درجة الثقة
      confidence := CASE 
        WHEN (male_products_count + female_products_count) = 0 THEN 0.5
        ELSE GREATEST(male_products_count, female_products_count)::NUMERIC / 
             (male_products_count + female_products_count)::NUMERIC
      END;
      
      -- تحديث أو إدراج تصنيف الجنس
      INSERT INTO customer_gender_segments (
        customer_id, 
        gender_type, 
        confidence_score, 
        last_analysis_date
      ) VALUES (
        customer_record.id,
        determined_gender,
        confidence,
        now()
      )
      ON CONFLICT (customer_id) DO UPDATE SET
        gender_type = EXCLUDED.gender_type,
        confidence_score = EXCLUDED.confidence_score,
        last_analysis_date = EXCLUDED.last_analysis_date,
        updated_at = now();
        
    END IF;
    
  END LOOP;
  
  RAISE NOTICE 'تم تحديث تصنيفات الجنس للعملاء بنجاح';
END;
$$;

-- إضافة أمثلة لتصنيف الجنس للفئات الموجودة
INSERT INTO product_gender_categories (gender_type, category_id, priority) 
SELECT 'male', c.id, 1
FROM categories c 
WHERE LOWER(c.name) LIKE ANY(ARRAY['%رجال%', '%ذكور%', '%men%', '%male%'])
ON CONFLICT DO NOTHING;

INSERT INTO product_gender_categories (gender_type, category_id, priority) 
SELECT 'female', c.id, 1
FROM categories c 
WHERE LOWER(c.name) LIKE ANY(ARRAY['%نساء%', '%نسائي%', '%اناث%', '%women%', '%female%'])
ON CONFLICT DO NOTHING;

-- تصنيف الأقسام
INSERT INTO product_gender_categories (gender_type, department_id, priority) 
SELECT 'male', d.id, 1
FROM departments d 
WHERE LOWER(d.name) LIKE ANY(ARRAY['%رجال%', '%ذكور%', '%men%', '%male%'])
ON CONFLICT DO NOTHING;

INSERT INTO product_gender_categories (gender_type, department_id, priority) 
SELECT 'female', d.id, 1
FROM departments d 
WHERE LOWER(d.name) LIKE ANY(ARRAY['%نساء%', '%نسائي%', '%اناث%', '%women%', '%female%'])
ON CONFLICT DO NOTHING;

-- تنفيذ التحديث الأولي
SELECT update_customer_gender_classification();