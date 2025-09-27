-- تنظيف الدوال المكررة في قاعدة البيانات
-- حذف النسخ القديمة من process_telegram_order

-- حذف النسخة الأولى القديمة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb);

-- حذف النسخة الثانية القديمة  
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint);

-- حذف النسخة الثالثة القديمة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid, boolean);

-- التأكد من بقاء النسخة الصحيحة فقط
-- النسخة الحالية: process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid DEFAULT NULL::uuid)

-- فحص وحذف أي دوال أخرى مكررة قد تسبب مشاكل
-- حذف النسخ القديمة من sync_recent_received_invoices إن وجدت
DROP FUNCTION IF EXISTS public.sync_recent_received_invoices();
DROP FUNCTION IF EXISTS public.sync_recent_received_invoices(integer);

-- حذف النسخ القديمة من validate_product_availability إن وجدت  
DROP FUNCTION IF EXISTS public.validate_product_availability(text, text, text, integer);

-- تنظيف أي دوال تجريبية أو مؤقتة
DROP FUNCTION IF EXISTS public.temp_process_telegram_order(jsonb, bigint, uuid);
DROP FUNCTION IF EXISTS public.test_process_telegram_order(jsonb, bigint);

-- تأكيد وجود الدالة الصحيحة فقط
-- التحقق من أن process_telegram_order(jsonb, bigint, uuid) موجودة وتعمل
SELECT routine_name, routine_type, specific_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'process_telegram_order'
ORDER BY routine_name;