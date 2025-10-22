-- السماح للمستخدمين المصرح لهم بحذف سجلات auto_delete_log
CREATE POLICY "Allow authenticated users to delete auto_delete_log"
ON public.auto_delete_log
FOR DELETE
TO authenticated
USING (true);