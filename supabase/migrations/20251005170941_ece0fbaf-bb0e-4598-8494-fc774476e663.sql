-- حذف الدوال الخاطئة بدقة (9 نسخ) مع الاحتفاظ بالدالة الصحيحة ذات 7 معاملات

-- 1. حذف النسخة بمعاملين (text, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text);

-- 2. حذف النسخة بـ 3 معاملات (text, text, bigint)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint);

-- 3. حذف النسخة بـ 4 معاملات (text, text, bigint, integer)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, p_city_id integer);

-- 4. حذف النسخة بـ 5 معاملات (text, text, bigint, integer, integer)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, p_city_id integer, p_region_id integer);

-- 5. حذف النسخة بـ 7 معاملات الخاطئة (text, text, bigint, text, text, text, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_order_number text, p_telegram_chat_id bigint, p_customer_name text, p_customer_phone text, p_customer_address text, p_city_name text);

-- 6. حذف النسخة بـ 8 معاملات (text, text, bigint, integer, integer, text, text, numeric)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, p_city_id integer, p_region_id integer, p_city_name text, p_region_name text, p_delivery_fee numeric);

-- 7. حذف النسخة بـ 10 معاملات (text, text, bigint, integer, integer, text, text, numeric, boolean, jsonb)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, p_city_id integer, p_region_id integer, p_city_name text, p_region_name text, p_delivery_fee numeric, p_auto_create boolean, p_order_data jsonb);

-- 8. حذف النسخة بـ 3 معاملات (bigint, text, jsonb)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_chat_id bigint, p_employee_id text, p_order_data jsonb);

-- 9. حذف النسخة بـ 2 معاملات (bigint, text)
DROP FUNCTION IF EXISTS public.process_telegram_order(p_chat_id bigint, p_products_text text);

-- ملاحظة: الدالة الصحيحة ذات 7 معاملات ستبقى كما هي:
-- process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, 
--                        p_city_id integer DEFAULT NULL, p_region_id integer DEFAULT NULL, 
--                        p_city_name text DEFAULT NULL, p_region_name text DEFAULT NULL)