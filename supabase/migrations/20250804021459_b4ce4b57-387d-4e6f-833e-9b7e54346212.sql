-- تشغيل دالة ترحيل العملاء لتوحيد البيانات حسب رقم الهاتف
SELECT public.migrate_existing_customers_to_phone_loyalty();

-- حذف الدوال الخاطئة القديمة للعملاء إن وجدت
DROP FUNCTION IF EXISTS public.update_customer_tier(uuid);
DROP FUNCTION IF EXISTS public.check_city_random_discount(text);
DROP FUNCTION IF EXISTS public.record_discount_usage(uuid, text, numeric, uuid);
DROP FUNCTION IF EXISTS public.generate_customer_promo_code(uuid);

-- إضافة فهرس لضمان عدم التكرار في أرقام الهواتف المطبعة
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_phone_loyalty_phone 
ON public.customer_phone_loyalty (phone_number);

-- تنظيف البيانات المكررة أولاً
DELETE FROM public.customer_phone_loyalty 
WHERE id NOT IN (
  SELECT DISTINCT ON (phone_number) id 
  FROM public.customer_phone_loyalty 
  ORDER BY phone_number, total_orders DESC, created_at DESC
);

-- إعادة تشغيل دالة الترحيل لضمان توحيد البيانات
SELECT public.migrate_existing_customers_to_phone_loyalty();