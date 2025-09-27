-- حذف جميع النسخ من process_telegram_order بدقة

-- حذف باستخدام كل specific_name موجود
DROP FUNCTION IF EXISTS public.process_telegram_order_106253 CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order_113084 CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order_106259 CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order_106227 CASCADE;

-- حذف أي نسخ متبقية بكل الاحتمالات
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, text, jsonb, text, numeric, numeric, text) CASCADE;

-- التحقق من عدم وجود أي نسخة متبقية
SELECT routine_name, routine_type, specific_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'process_telegram_order';