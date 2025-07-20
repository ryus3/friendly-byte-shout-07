-- إضافة سياسة حذف المصاريف للمديرين والمستخدمين الذين أنشأوا المصروف
CREATE POLICY "المستخدمون والمديرون يحذفون المصاريف" 
ON public.expenses 
FOR DELETE 
USING ((created_by = auth.uid()) OR is_admin_or_deputy());