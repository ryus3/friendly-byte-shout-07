-- إصلاح جذري للبوت التليغرام - حذف الوظيفة القديمة الخاطئة
-- حذف الوظيفة القديمة التي تسبب المشكلة
DROP FUNCTION IF EXISTS public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid);

-- التأكد من وجود الوظيفة الصحيحة فقط
-- الوظيفة الصحيحة موجودة بالفعل: process_telegram_order(p_message_text text, p_chat_id bigint)