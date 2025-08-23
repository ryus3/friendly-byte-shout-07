-- إصلاح التحذيرات الأمنية: تحديث search_path للدوال الموجودة
ALTER FUNCTION auto_archive_settled_orders() SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION review_archive_status() SET search_path TO 'public', 'pg_temp';