-- إصلاح RLS policies لجدول orders لضمان إمكانية إنشاء طلبات
-- إضافة policy للسماح للمستخدمين المصرح لهم بإنشاء طلبات

-- حذف policies قديمة قد تسبب مشاكل
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;

-- إنشاء policy جديدة شاملة لإنشاء الطلبات
CREATE POLICY "Authenticated users can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

-- التأكد من policy القراءة
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
CREATE POLICY "Users can view accessible orders" 
ON public.orders 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by = auth.uid() 
    OR is_admin_or_deputy()
    OR check_user_permission(auth.uid(), 'view_all_orders'::text)
  )
);

-- التأكد من policy التحديث
DROP POLICY IF EXISTS "Users can update their orders" ON public.orders;
CREATE POLICY "Users can update accessible orders" 
ON public.orders 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by = auth.uid() 
    OR is_admin_or_deputy()
    OR check_user_permission(auth.uid(), 'edit_all_orders'::text)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    created_by = auth.uid() 
    OR is_admin_or_deputy()
    OR check_user_permission(auth.uid(), 'edit_all_orders'::text)
  )
);