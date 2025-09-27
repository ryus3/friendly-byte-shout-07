-- حذف النسخ المحددة من process_telegram_order والاحتفاظ بواحدة فقط

-- حذف النسخ بالأسماء المحددة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb) CASCADE;

-- التحقق النهائي من وجود نسخة واحدة فقط
SELECT routine_name, routine_type, specific_name, 
       pg_get_function_identity_arguments(p.oid) as function_signature
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public' 
AND routine_name = 'process_telegram_order'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY routine_name;