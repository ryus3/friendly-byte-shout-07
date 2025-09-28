-- حذف الدالة المكررة القديمة التي تأخذ معاملين فقط
DROP FUNCTION IF EXISTS public.process_telegram_order_detailed(p_message_text text, p_chat_id bigint);

-- تأكيد وجود الدالة الجديدة المحسنة فقط (تأخذ 4 معاملات)
-- هذه الدالة موجودة مسبقاً ولن نحذفها