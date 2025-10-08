-- إصلاح RLS policies على ai_orders للسماح بالإدخال من SECURITY DEFINER functions

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "Authenticated users can manage ai orders" ON public.ai_orders;
DROP POLICY IF EXISTS "Authenticated users can view ai orders" ON public.ai_orders;

-- سياسة INSERT جديدة: السماح إذا كان المستخدم مسجل دخول أو إذا كان created_by موجود
CREATE POLICY "Allow insert for authenticated or with created_by"
ON public.ai_orders
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  OR created_by IS NOT NULL
);

-- سياسة SELECT: المستخدمون المسجلون يمكنهم عرض الطلبات
CREATE POLICY "Authenticated users can view ai orders"
ON public.ai_orders
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- سياسة UPDATE: المستخدمون المسجلون يمكنهم تحديث الطلبات
CREATE POLICY "Authenticated users can update ai orders"
ON public.ai_orders
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- سياسة DELETE: المستخدمون المسجلون يمكنهم حذف الطلبات
CREATE POLICY "Authenticated users can delete ai orders"
ON public.ai_orders
FOR DELETE
USING (auth.uid() IS NOT NULL);