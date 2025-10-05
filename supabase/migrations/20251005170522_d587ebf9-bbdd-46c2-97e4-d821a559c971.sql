-- حذف الدوال الخاطئة بدقة (9 نسخ) مع الاحتفاظ بالدالة الصحيحة ذات 7 معاملات

-- 1. حذف النسخة بدون معاملات
DROP FUNCTION IF EXISTS public.process_telegram_order();

-- 2. حذف النسخة بمعامل واحد (bigint)
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint);

-- 3. حذف النسخة بمعاملين (bigint, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text);

-- 4. حذف النسخة بـ 3 معاملات (text, text, bigint)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint);

-- 5. حذف النسخة بـ 4 معاملات (text, text, bigint, integer)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer);

-- 6. حذف النسخة بـ 5 معاملات (text, text, bigint, integer, integer)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer);

-- 7. حذف النسخة بـ 6 معاملات (text, text, bigint, integer, integer, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text);

-- 8. حذف النسخة بـ 7 معاملات الخاطئة (text, bigint, text, text, text, text, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, text, text, text, text, text);

-- 9. حذف النسخة بـ 8 معاملات (text, text, bigint, integer, integer, text, text, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text, text);

-- 10. حذف النسخة بـ 10 معاملات (text, text, bigint, integer, integer, text, text, text, boolean, jsonb)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text, text, boolean, jsonb);

-- ملاحظة: الدالة الصحيحة ذات 7 معاملات ستبقى كما هي:
-- process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, 
--                        p_city_id integer, p_region_id integer, p_city_name text, p_region_name text)