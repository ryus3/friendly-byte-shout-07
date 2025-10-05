-- حذف النسخ القديمة من process_telegram_order والإبقاء على النسخة الصحيحة فقط

-- حذف النسخة ذات 5 parameters (قديمة - OID: 125143)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer);

-- حذف النسخة القديمة ذات 3 parameters (OID: 125142)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint);

-- ✅ الإبقاء على النسخة الصحيحة ذات 7 parameters (OID: 125144)
-- DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text);

-- ملاحظة: النسخة المستخدمة حالياً هي:
-- process_telegram_order(p_employee_code text, p_message_text text, p_telegram_chat_id bigint, 
--                         p_city_id integer, p_region_id integer, p_city_name text, p_region_name text)
-- سيتم الإبقاء عليها فقط