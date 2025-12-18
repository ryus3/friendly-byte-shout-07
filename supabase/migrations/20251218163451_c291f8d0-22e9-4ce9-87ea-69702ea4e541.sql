-- 1. إنشاء دالة للتحقق من صلاحية رؤية الطلبات الذكية مع دعم علاقات الإشراف
CREATE OR REPLACE FUNCTION public.can_view_ai_order(order_created_by text)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- المدير والنائب يرون كل شيء
  IF EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin', 'deputy_admin')
    AND ur.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- المستخدم يرى طلباته الخاصة
  IF order_created_by = auth.uid()::text THEN
    RETURN TRUE;
  END IF;
  
  -- مدير القسم يرى طلبات الموظفين تحت إشرافه فقط
  IF EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name = 'department_manager'
    AND ur.is_active = true
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM employee_supervisors es
      WHERE es.supervisor_id = auth.uid() 
      AND es.employee_id::text = order_created_by
      AND es.is_active = true
    );
  END IF;
  
  RETURN FALSE;
END;
$$;

-- 2. حذف السياسة القديمة
DROP POLICY IF EXISTS "Employees see own ai_orders" ON ai_orders;

-- 3. إنشاء سياسة جديدة مع عزل صحيح
CREATE POLICY "Employees see own ai_orders" ON ai_orders 
FOR SELECT
USING (
  can_view_ai_order(created_by) 
  OR processed_by = auth.uid()
);