-- حذف الدالة المساعدة التي كانت تسبب مشاكل
DROP FUNCTION IF EXISTS public.get_product_available_variants(uuid, text, text);