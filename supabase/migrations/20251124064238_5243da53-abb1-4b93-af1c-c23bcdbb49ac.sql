-- المرحلة 1: توحيد نظام الولاء - دمج السجلات المكررة
-- ========================================================

-- 1. تفعيل دالة الدمج الموجودة
SELECT migrate_existing_customers_to_phone_loyalty();

-- 2. إضافة UNIQUE INDEX لمنع التكرار مستقبلاً
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_phone_loyalty_phone 
ON customer_phone_loyalty(phone_number);

-- 3. التحقق من النتائج
DO $$
DECLARE
  total_unique_phones INTEGER;
  total_loyalty_records INTEGER;
BEGIN
  SELECT COUNT(DISTINCT phone_number) INTO total_unique_phones FROM customer_phone_loyalty;
  SELECT COUNT(*) INTO total_loyalty_records FROM customer_phone_loyalty;
  
  RAISE NOTICE 'توحيد الولاء: % رقم فريد في % سجل', total_unique_phones, total_loyalty_records;
  
  IF total_unique_phones != total_loyalty_records THEN
    RAISE EXCEPTION 'خطأ: لا تزال توجد سجلات مكررة!';
  END IF;
END $$;

-- المرحلة 2: تفعيل مكافآت المدن للشهر الحالي
-- ========================================================

-- 1. إنشاء مكافأة "توصيل مجاني" لعميل واحد عشوائي من بغداد
INSERT INTO city_monthly_benefits (
  city_name,
  year,
  month,
  benefit_type,
  benefit_value,
  max_usage,
  current_usage,
  is_active
)
VALUES (
  'بغداد',
  2025,
  11,
  'free_delivery',
  100, -- نسبة الخصم (100% = مجاني)
  1,   -- عميل واحد فقط
  0,   -- لم يُستخدم بعد
  true
)
ON CONFLICT DO NOTHING;

-- 2. إنشاء مكافأة "خصم 5% + توصيل مجاني" لعميل آخر
INSERT INTO city_monthly_benefits (
  city_name,
  year,
  month,
  benefit_type,
  benefit_value,
  max_usage,
  current_usage,
  is_active
)
VALUES (
  'بغداد',
  2025,
  11,
  'discount_with_free_delivery',
  5,   -- خصم 5%
  1,   -- عميل واحد فقط
  0,   -- لم يُستخدم بعد
  true
)
ON CONFLICT DO NOTHING;

-- 3. إنشاء خصم عشوائي شهري للمدينة (5%)
INSERT INTO city_random_discounts (
  city_name,
  discount_year,
  discount_month,
  discount_percentage
)
VALUES (
  'بغداد',
  2025,
  11,
  5
)
ON CONFLICT DO NOTHING;

-- 4. تحديث إحصائيات المدن للشهر الحالي (ضمان البيانات محدثة)
INSERT INTO city_order_stats (city_name, year, month, total_orders, total_amount)
SELECT 
  customer_city,
  EXTRACT(YEAR FROM created_at)::INTEGER,
  EXTRACT(MONTH FROM created_at)::INTEGER,
  COUNT(*),
  COALESCE(SUM(total_amount), 0)
FROM orders
WHERE customer_city IS NOT NULL 
  AND status IN ('delivered', 'completed')
  AND EXTRACT(YEAR FROM created_at) = 2025
  AND EXTRACT(MONTH FROM created_at) = 11
GROUP BY customer_city, EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
ON CONFLICT (city_name, year, month) 
DO UPDATE SET 
  total_orders = EXCLUDED.total_orders,
  total_amount = EXCLUDED.total_amount,
  updated_at = now();

-- المرحلة 3: إنشاء view للعملاء الموحدين (للواجهة الأمامية)
-- ========================================================

CREATE OR REPLACE VIEW customers_unified_loyalty AS
SELECT 
  cpl.id,
  cpl.phone_number,
  cpl.customer_name,
  cpl.customer_city,
  cpl.customer_province,
  cpl.total_points,
  cpl.total_orders,
  cpl.total_spent,
  cpl.current_tier_id,
  lt.name as tier_name,
  lt.discount_percentage as tier_discount,
  lt.free_delivery_threshold,
  lt.points_expiry_months,
  cpl.points_expiry_date,
  cpl.first_order_date,
  cpl.last_order_date,
  cpl.created_at,
  cpl.updated_at
FROM customer_phone_loyalty cpl
LEFT JOIN loyalty_tiers lt ON cpl.current_tier_id = lt.id
ORDER BY cpl.total_points DESC, cpl.total_orders DESC;

-- منح صلاحيات القراءة للـ view
GRANT SELECT ON customers_unified_loyalty TO authenticated;

-- RLS policy للـ view
ALTER VIEW customers_unified_loyalty SET (security_invoker = true);

-- تقرير نهائي
DO $$
DECLARE
  v_total_customers INTEGER;
  v_total_benefits INTEGER;
  v_active_city TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total_customers FROM customer_phone_loyalty;
  SELECT COUNT(*) INTO v_total_benefits FROM city_monthly_benefits WHERE is_active = true;
  SELECT city_name INTO v_active_city FROM city_order_stats 
    WHERE year = 2025 AND month = 11 
    ORDER BY total_orders DESC LIMIT 1;
  
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ اكتمل توحيد نظام الولاء';
  RAISE NOTICE '📊 إجمالي العملاء الفريدين: %', v_total_customers;
  RAISE NOTICE '🎁 مكافآت نشطة: %', v_total_benefits;
  RAISE NOTICE '🏆 المدينة المتميزة: %', v_active_city;
  RAISE NOTICE '================================';
END $$;