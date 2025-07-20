-- حذف المصروف التجريبي لاستعادة الرصيد الصحيح
DELETE FROM public.expenses 
WHERE receipt_number = 'TEST-001' 
AND description = 'مصروف تجريبي لاختبار النظام';