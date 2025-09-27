-- حذف النسخ الزائدة من process_telegram_order والاحتفاظ بالنسخة الصحيحة فقط

-- حذف النسخ الزائدة باستخدام specific_name
DROP FUNCTION IF EXISTS public.process_telegram_order_106253(jsonb, bigint, uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order_113084(jsonb, bigint, uuid);  
DROP FUNCTION IF EXISTS public.process_telegram_order_106259(jsonb, bigint, uuid);

-- الاحتفاظ بالنسخة الصحيحة process_telegram_order_106227 فقط

-- التحقق النهائي من وجود نسخة واحدة فقط
SELECT routine_name, routine_type, specific_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'process_telegram_order'
ORDER BY routine_name;