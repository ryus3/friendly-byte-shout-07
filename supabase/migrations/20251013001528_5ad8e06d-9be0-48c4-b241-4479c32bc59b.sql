-- إصلاح WARN 1 & 2: Function Search Path Mutable
-- إضافة SET search_path للدوال الأمنية

-- تحديث دالة is_admin_or_deputy_secure
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy_secure()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  );
$function$;

-- تحديث دالة can_view_all_orders
CREATE OR REPLACE FUNCTION public.can_view_all_orders()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (
        r.name IN ('super_admin', 'admin', 'deputy')
        OR p.name = 'view_all_orders'
      )
  );
$function$;