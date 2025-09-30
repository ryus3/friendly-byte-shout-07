-- حذف جميع النسخ القديمة من process_telegram_order والإبقاء على النسخة الصحيحة فقط

-- حذف النسخة #1 (بدون employee)
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_customer_name text, 
  p_customer_phone text, 
  p_customer_address text, 
  p_items jsonb, 
  p_telegram_chat_id bigint, 
  p_original_text text
);

-- حذف النسخة #2 (تستخدم employee_id بدلاً من employee_code - المشكلة الرئيسية!)
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_chat_id bigint, 
  p_message_text text, 
  p_employee_id uuid
);

-- حذف النسخة #3 (ترتيب خاطئ للمعاملات)
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_message_text text, 
  p_chat_id bigint, 
  p_employee_code text
);

-- الآن يوجد فقط النسخة الصحيحة:
-- process_telegram_order(p_chat_id bigint, p_message_text text, p_employee_code text)