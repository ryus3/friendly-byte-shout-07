-- حذف السياسات التي تعتمد على profiles.role أولاً ثم حذف العمود
-- حذف السياسات القديمة التي تعتمد على profiles.role
DROP POLICY IF EXISTS "Users can view their own profits" ON public.profits;
DROP POLICY IF EXISTS "Admins can manage all profits" ON public.profits;
DROP POLICY IF EXISTS "allow_admins_full_access" ON public.employee_profit_rules;
DROP POLICY IF EXISTS "allow_employees_view_own_rules" ON public.employee_profit_rules;

-- الآن يمكن حذف عمود role من profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;

-- تحديث دالة is_admin_or_deputy للاعتماد على النظام الهرمي
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  -- التحقق من النظام الهرمي الجديد
  RETURN public.check_user_permission(auth.uid(), 'view_all_data') OR
         public.check_user_permission(auth.uid(), 'manage_employees');
END;
$function$;

-- إضافة دالة جديدة للتحقق من الأدوار الهرمية
CREATE OR REPLACE FUNCTION public.check_user_role(p_user_id uuid, p_role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
        AND r.name = p_role_name
        AND ur.is_active = true
        AND r.is_active = true
    );
END;
$function$;

-- إضافة دالة لجلب دور المستخدم الهرمي
CREATE OR REPLACE FUNCTION public.get_user_highest_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    highest_role text;
BEGIN
    SELECT r.name INTO highest_role
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id 
    AND ur.is_active = true
    AND r.is_active = true
    ORDER BY r.hierarchy_level ASC
    LIMIT 1;
    
    RETURN COALESCE(highest_role, 'sales_employee');
END;
$function$;

-- إعادة إنشاء سياسات الأرباح بالنظام الجديد
CREATE POLICY "المديرون يديرون كل الأرباح"
ON public.profits
FOR ALL
TO authenticated
USING (public.check_user_permission(auth.uid(), 'view_all_profits'));

CREATE POLICY "الموظفون يرون أرباحهم"
ON public.profits
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid() OR 
  public.check_user_permission(auth.uid(), 'view_all_profits')
);

-- إعادة إنشاء سياسات قواعد أرباح الموظفين
CREATE POLICY "المديرون يديرون قواعد الأرباح"
ON public.employee_profit_rules
FOR ALL
TO authenticated
USING (public.check_user_permission(auth.uid(), 'manage_profit_settlement'));

CREATE POLICY "الموظفون يرون قواعد أرباحهم"
ON public.employee_profit_rules
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid() OR 
  public.check_user_permission(auth.uid(), 'view_all_profits')
);