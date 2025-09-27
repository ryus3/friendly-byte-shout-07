-- حذف الوظيفة المكررة القديمة من smart_search_region
DROP FUNCTION IF EXISTS public.smart_search_region(text);

-- التأكد من وجود الوظيفة الجديدة المحسنة فقط
-- (الوظيفة الجديدة التي تأخذ معاملين موجودة بالفعل)