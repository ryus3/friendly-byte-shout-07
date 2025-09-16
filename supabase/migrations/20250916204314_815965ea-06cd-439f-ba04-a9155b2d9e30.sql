-- حذف جميع إصدارات الدالة القديمة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer, numeric, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer, numeric, jsonb, bigint);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer, numeric, jsonb);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer, numeric);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb);