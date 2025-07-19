-- دالة لحذف الفواتير المحذوفة نهائياً من النظام
CREATE OR REPLACE FUNCTION public.cleanup_deleted_purchases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- حذف الفواتير القديمة التي لا تحتوي على بيانات حقيقية
  DELETE FROM public.purchase_items 
  WHERE purchase_id IN (
    SELECT id FROM public.purchases 
    WHERE purchase_number ~ '^PUR-'
    OR supplier_name = 'test'
    OR supplier_name = 'تجربة'
    OR created_at < '2025-07-19 22:00:00'
  );
  
  DELETE FROM public.purchases 
  WHERE purchase_number ~ '^PUR-'
  OR supplier_name = 'test'
  OR supplier_name = 'تجربة'
  OR created_at < '2025-07-19 22:00:00';
  
  -- حذف المصاريف المرتبطة بالفواتير المحذوفة
  DELETE FROM public.expenses 
  WHERE receipt_number ~ '^PUR-'
  OR description LIKE '%تجربة%'
  OR description LIKE '%test%';
  
  RAISE NOTICE 'تم تنظيف الفواتير المحذوفة بنجاح';
END;
$function$;

-- تشغيل دالة التنظيف
SELECT public.cleanup_deleted_purchases();