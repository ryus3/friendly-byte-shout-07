-- حذف النسخ القديمة من دالة process_telegram_order
-- الاحتفاظ فقط بالنسخة الصحيحة: process_telegram_order(bigint, text)

-- حذف النسخة القديمة الأولى
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint);

-- حذف النسخة القديمة الثانية
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, uuid);

-- الآن يوجد فقط النسخة الصحيحة: process_telegram_order(p_chat_id bigint, p_message_text text)
-- هذه النسخة تستخدم telegram_code بشكل صحيح ولا تحاول الوصول إلى auth.users.full_name