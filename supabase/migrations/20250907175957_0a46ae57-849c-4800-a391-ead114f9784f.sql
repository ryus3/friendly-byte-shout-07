-- إضافة trigger لمزامنة حالة الأرباح مع استلام الفاتورة
CREATE OR REPLACE FUNCTION public.sync_profit_status_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- عند تحديث حالة استلام الفاتورة إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- تحديث حالة الأرباح المرتبطة بالطلب إلى invoice_received
    UPDATE public.profits 
    SET 
      status = 'invoice_received',
      updated_at = now()
    WHERE order_id = NEW.id 
      AND status = 'pending';
      
    RAISE NOTICE 'تم تحديث حالة الربح للطلب % إلى invoice_received', NEW.order_number;
  END IF;

  -- عند إلغاء استلام الفاتورة (تحديث إلى false)
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    -- إعادة حالة الأرباح إلى pending
    UPDATE public.profits 
    SET 
      status = 'pending',
      updated_at = now()
    WHERE order_id = NEW.id 
      AND status = 'invoice_received';
      
    RAISE NOTICE 'تم إعادة حالة الربح للطلب % إلى pending', NEW.order_number;
  END IF;

  RETURN NEW;
END;
$function$;

-- ربط التريجر بجدول الطلبات
DROP TRIGGER IF EXISTS sync_profit_status_trigger ON public.orders;
CREATE TRIGGER sync_profit_status_trigger
  AFTER UPDATE OF receipt_received ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profit_status_on_invoice();

-- إضافة سياسة RLS للموظفين لتحديث حالة أرباحهم عند طلب التسوية
CREATE POLICY "الموظفون يمكنهم طلب تسوية أرباحهم" 
ON public.profits 
FOR UPDATE 
USING (
  employee_id = auth.uid() 
  AND status = 'invoice_received'
  AND EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = profits.order_id 
    AND o.receipt_received = true
  )
)
WITH CHECK (
  employee_id = auth.uid() 
  AND status IN ('settlement_requested', 'invoice_received')
);