-- إصلاح RLS Policy على order_items لحل مشكلة طلبات الاستبدال

-- حذف policies القديمة
DROP POLICY IF EXISTS "Authenticated users can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;

-- إنشاء policy جديد واضح وصريح لجميع العمليات
CREATE POLICY "Allow all operations for authenticated users" 
ON public.order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);