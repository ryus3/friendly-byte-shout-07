-- إصلاح function للحصول على بيانات الموظف مع الدور
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_telegram_chat_id bigint)
 RETURNS TABLE(user_id uuid, employee_code text, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    tec.employee_code,
    p.full_name,
    COALESCE(
      (SELECT r.name 
       FROM public.user_roles ur 
       JOIN public.roles r ON ur.role_id = r.id 
       WHERE ur.user_id = p.user_id 
       AND ur.is_active = true 
       ORDER BY r.hierarchy_level ASC 
       LIMIT 1), 
      'employee'
    ) as role
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_telegram_chat_id 
    AND tec.is_active = true
    AND p.is_active = true;
END;
$function$;