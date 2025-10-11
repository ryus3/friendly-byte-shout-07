-- تحديث trigger لإكمال الطلبات عند استلام الفاتورة
-- الشرط الجديد: الطلب مكتمل عندما يكون status في (settled, invoice_received)

CREATE OR REPLACE FUNCTION public.complete_order_when_profit_settled_or_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- إذا تم تحديث حالة الربح إلى settled أو invoice_received
  IF NEW.status IN ('settled', 'invoice_received') 
     AND COALESCE(OLD.status, '') NOT IN ('settled', 'invoice_received') THEN
    
    -- تحديث الطلب إلى completed إذا كانت الفاتورة مستلمة
    UPDATE public.orders o
    SET 
      status = 'completed', 
      updated_at = now()
    WHERE o.id = NEW.order_id
      AND o.receipt_received = true
      AND o.status NOT IN ('completed', 'cancelled');
    
    RAISE NOTICE 'تم إكمال الطلب % بناءً على حالة الربح: %', NEW.order_id, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS trigger_complete_order_when_profit_settled ON public.profits;

-- إنشاء الـ trigger الجديد
CREATE TRIGGER trigger_complete_order_when_profit_settled
  AFTER UPDATE ON public.profits
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_order_when_profit_settled_or_received();