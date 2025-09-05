-- إصلاح RLS policies للطلبات - حذف السياسات المتضاربة وتوحيد الصلاحيات

-- حذف السياسة المتساهلة التي تسمح لكل المستخدمين برؤية جميع الطلبات
DROP POLICY IF EXISTS "Orders viewable by authenticated users" ON public.orders;

-- حذف السياسات المكررة أو المتضاربة
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "All authenticated users can view orders" ON public.orders;

-- إنشاء سياسة موحدة ومحسنة للموظفين لرؤية طلباتهم
CREATE POLICY "الموظفون يرون طلباتهم والمديرون يرون الكل"
ON public.orders
FOR SELECT
USING (
  -- المدير والنائب يرون كل الطلبات
  is_admin_or_deputy() 
  OR 
  -- المستخدمون المصرح لهم برؤية جميع الطلبات
  check_user_permission(auth.uid(), 'view_all_orders') 
  OR 
  -- الموظفون يرون طلباتهم التي أنشؤوها فقط
  created_by = auth.uid()
);

-- تحسين سياسة الإدراج للطلبات
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
CREATE POLICY "المستخدمون المصرح لهم ينشئون الطلبات"
ON public.orders
FOR INSERT
WITH CHECK (
  -- التأكد من أن منشئ الطلب هو المستخدم الحالي
  created_by = auth.uid()
  AND 
  -- المستخدم له صلاحية إنشاء الطلبات
  (check_user_permission(auth.uid(), 'create_orders') OR is_admin_or_deputy())
);

-- تحسين سياسة التحديث للطلبات
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
CREATE POLICY "المستخدمون يحدثون طلباتهم والمديرون يحدثون الكل"
ON public.orders
FOR UPDATE
USING (
  -- المدير والنائب يحدثون كل الطلبات
  is_admin_or_deputy() 
  OR 
  -- المستخدمون المصرح لهم بتحديث جميع الطلبات
  check_user_permission(auth.uid(), 'manage_orders') 
  OR 
  -- الموظفون يحدثون طلباتهم فقط
  created_by = auth.uid()
);

-- تحسين سياسة الحذف للطلبات
DROP POLICY IF EXISTS "Users can delete orders" ON public.orders;
CREATE POLICY "المديرون والمستخدمون المصرح لهم يحذفون الطلبات"
ON public.orders
FOR DELETE
USING (
  -- المدير والنائب يحذفون كل الطلبات
  is_admin_or_deputy() 
  OR 
  -- المستخدمون المصرح لهم بحذف الطلبات
  check_user_permission(auth.uid(), 'delete_orders')
  OR 
  -- الموظفون يحذفون طلباتهم فقط إذا كانت في حالة pending
  (created_by = auth.uid() AND status IN ('pending', 'draft'))
);

-- إضافة دالة تشخيص لمراقبة RLS
CREATE OR REPLACE FUNCTION public.debug_orders_rls(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_info jsonb;
  v_orders_count integer;
  v_user_orders_count integer;
  v_is_admin boolean;
  v_permissions text[];
BEGIN
  -- جمع معلومات المستخدم
  SELECT is_admin_or_deputy() INTO v_is_admin;
  
  -- جمع الصلاحيات
  SELECT array_agg(p.name) INTO v_permissions
  FROM permissions p
  JOIN role_permissions rp ON p.id = rp.permission_id
  JOIN user_roles ur ON rp.role_id = ur.role_id
  WHERE ur.user_id = p_user_id AND ur.is_active = true;
  
  -- عدد الطلبات الإجمالي
  SELECT COUNT(*) INTO v_orders_count FROM orders;
  
  -- عدد الطلبات التي يراها المستخدم
  SELECT COUNT(*) INTO v_user_orders_count 
  FROM orders 
  WHERE (
    v_is_admin 
    OR 'view_all_orders' = ANY(v_permissions)
    OR created_by = p_user_id
  );
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'is_admin', v_is_admin,
    'permissions', v_permissions,
    'total_orders', v_orders_count,
    'visible_orders', v_user_orders_count,
    'can_see_all', v_is_admin OR 'view_all_orders' = ANY(v_permissions),
    'timestamp', now()
  );
END;
$$;