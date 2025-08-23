-- إصلاح التحذيرات الأمنية: تعيين search_path للدالة المحدثة
ALTER FUNCTION public.repair_alwaseet_order_mapping(uuid) SET search_path TO 'public', 'pg_temp';