-- حذف كل النسخ من process_telegram_order بتحديد المعاملات

DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, bigint, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, text, jsonb, text, numeric, numeric, text) CASCADE;

-- التحقق من النظافة
SELECT routine_name, routine_type, specific_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'process_telegram_order';