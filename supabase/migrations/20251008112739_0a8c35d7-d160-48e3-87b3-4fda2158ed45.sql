-- حذف الدالة الخاطئة ذات 3 معاملات
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, uuid);

-- الدالة الأصلية ذات 7 معاملات ستبقى كما هي
-- لأنها تستخدم بالفعل extract_product_items_from_text(p_message_text) بشكل صحيح