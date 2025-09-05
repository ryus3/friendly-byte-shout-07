-- استعادة الطلبين المحذوفين للمدير
INSERT INTO public.orders (
  tracking_number,
  delivery_partner_order_id, 
  delivery_partner,
  delivery_account_code,
  status,
  delivery_status,
  created_by,
  customer_name,
  customer_phone,
  customer_address,
  customer_city,
  final_amount,
  created_at,
  updated_at,
  order_number
) VALUES 
('100503893', '100503893', 'alwaseet', 'Ryusiq', 'delivered', 'تم التسليم للزبون', '91484496-b887-44f7-9e5d-be9db5567604'::uuid, 'عميل مسترد - استعادة', '07xxxxxxxxx', 'عنوان مؤقت', 'بغداد', 50000, '2025-08-01 10:00:00+00'::timestamptz, now(), 'ORD000013'),
('100579474', '100579474', 'alwaseet', 'Ryusiq', 'delivered', 'تم التسليم للزبون', '91484496-b887-44f7-9e5d-be9db5567604'::uuid, 'عميل مسترد - استعادة', '07xxxxxxxxx', 'عنوان مؤقت', 'بغداد', 50000, '2025-08-01 10:00:00+00'::timestamptz, now(), 'ORD000014');

-- إضافة دالة للتحقق من صلاحيات المدير
CREATE OR REPLACE FUNCTION public.is_manager_user(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
$$;

-- دالة للحصول على فلتر البيانات الآمن
CREATE OR REPLACE FUNCTION public.get_safe_user_filter(
  p_user_id uuid DEFAULT auth.uid(),
  p_delivery_account_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}';
BEGIN
  -- إذا كان المدير، لا فلترة (يرى كل شيء)
  IF is_manager_user(p_user_id) THEN
    RETURN '{"is_admin": true}'::jsonb;
  END IF;
  
  -- للموظفين: فلترة حسب المستخدم والحساب النشط
  result := jsonb_build_object(
    'is_admin', false,
    'user_id', p_user_id,
    'delivery_account_code', p_delivery_account_code
  );
  
  RETURN result;
END;
$$;

-- دالة للتحقق من إمكانية الوصول للطلب
CREATE OR REPLACE FUNCTION public.can_access_order(
  p_order_created_by uuid,
  p_order_delivery_account_code text,
  p_user_id uuid DEFAULT auth.uid(),
  p_active_account_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- المدير يصل لكل شيء
  IF is_manager_user(p_user_id) THEN
    RETURN true;
  END IF;
  
  -- التحقق من ملكية الطلب
  IF p_order_created_by != p_user_id THEN
    RETURN false;
  END IF;
  
  -- التحقق من مطابقة الحساب النشط (إذا كان محدد)
  IF p_active_account_code IS NOT NULL AND 
     p_order_delivery_account_code IS DISTINCT FROM p_active_account_code THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;