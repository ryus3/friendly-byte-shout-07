-- إصلاح مشاكل الأمان المكتشفة
-- 1. إصلاح search_path للدالة
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin', 'deputy_admin')
    AND ur.is_active = true
    AND r.is_active = true
  );
END;
$$;

-- 2. إصلاح دالة التحقق من الصلاحيات مع search_path آمن
CREATE OR REPLACE FUNCTION public.check_user_permission(p_user_id uuid, p_permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    -- فحص إذا كان المستخدم له الصلاحية مباشرة عبر الأدوار
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id 
        AND p.name = p_permission_name
        AND ur.is_active = true
        AND p.is_active = true
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$;