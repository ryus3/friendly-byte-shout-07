-- إعادة تشغيل دالة الترحيل مع تصحيح لضمان عدم التكرار
SELECT public.migrate_existing_customers_to_phone_loyalty();

-- التحقق من البيانات النهائية
SELECT phone_number, customer_name, total_orders, total_points, total_spent 
FROM customer_phone_loyalty 
ORDER BY total_orders DESC;