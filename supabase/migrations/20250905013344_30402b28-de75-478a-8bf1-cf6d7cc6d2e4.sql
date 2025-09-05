-- إصلاحات الأمان: إزالة SECURITY DEFINER لأن الدوال لا تصل إلى جداول
-- دالة: is_manager_user
CREATE OR REPLACE FUNCTION public.is_manager_user(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
$$;

-- دالة: get_safe_user_filter
CREATE OR REPLACE FUNCTION public.get_safe_user_filter(
  p_user_id uuid DEFAULT auth.uid(),
  p_delivery_account_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}';
BEGIN
  IF is_manager_user(p_user_id) THEN
    RETURN '{"is_admin": true}'::jsonb;
  END IF;

  result := jsonb_build_object(
    'is_admin', false,
    'user_id', p_user_id,
    'delivery_account_code', p_delivery_account_code
  );

  RETURN result;
END;
$$;

-- دالة: can_access_order
CREATE OR REPLACE FUNCTION public.can_access_order(
  p_order_created_by uuid,
  p_order_delivery_account_code text,
  p_user_id uuid DEFAULT auth.uid(),
  p_active_account_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF is_manager_user(p_user_id) THEN
    RETURN true;
  END IF;

  IF p_order_created_by != p_user_id THEN
    RETURN false;
  END IF;

  IF p_active_account_code IS NOT NULL AND 
     p_order_delivery_account_code IS DISTINCT FROM p_active_account_code THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;