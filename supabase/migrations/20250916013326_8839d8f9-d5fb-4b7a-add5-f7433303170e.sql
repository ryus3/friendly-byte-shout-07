-- إصلاح شامل للنظام

-- 1. تحديث فاتورة RY-603313 من approved إلى completed
UPDATE public.settlement_invoices 
SET status = 'completed', updated_at = now()
WHERE external_id = 'RY-603313' AND status = 'approved';

-- 2. أرشفة الطلب 101264291 والطلبات المشابهة (ربح موظف = 0 + استلام فاتورة)
UPDATE public.orders 
SET isarchived = true, updated_at = now()
WHERE id IN (
  SELECT o.id 
  FROM orders o
  JOIN profits p ON o.id = p.order_id
  WHERE o.receipt_received = true
    AND p.employee_profit = 0
    AND o.status IN ('delivered', 'completed')
    AND o.isarchived = false
);

-- 3. إنشاء دالة لأرشفة الطلبات بدون مستحقات تلقائياً
CREATE OR REPLACE FUNCTION public.auto_archive_zero_profit_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- عند تحديث حالة استلام الفاتورة إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- التحقق من وجود ربح موظف = 0
    IF EXISTS (
      SELECT 1 FROM public.profits p 
      WHERE p.order_id = NEW.id 
        AND p.employee_profit = 0
        AND NEW.status IN ('delivered', 'completed')
    ) THEN
      -- أرشفة الطلب تلقائياً
      NEW.isarchived := true;
      
      RAISE NOTICE 'تم أرشفة الطلب % تلقائياً - لا مستحقات للموظف', 
        COALESCE(NEW.order_number, NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. إنشاء trigger للأرشفة التلقائية
DROP TRIGGER IF EXISTS auto_archive_zero_profit_trigger ON public.orders;
CREATE TRIGGER auto_archive_zero_profit_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_zero_profit_orders();

-- 5. إنشاء دالة لضمان تناسق حالات الفواتير
CREATE OR REPLACE FUNCTION public.ensure_invoice_consistency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- تحديث جميع الفواتير المعتمدة (approved) لتصبح مكتملة (completed)
  -- إذا كانت مرتبطة بأرباح مستلمة فعلياً
  UPDATE public.settlement_invoices si
  SET status = 'completed', updated_at = now()
  WHERE si.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.settlement_invoice_profits sip
      JOIN public.profits p ON sip.profit_id = p.id
      WHERE sip.invoice_id = si.id
    );
  
  RAISE NOTICE 'تم تحديث تناسق حالات الفواتير';
END;
$function$;

-- تشغيل دالة ضمان التناسق
SELECT public.ensure_invoice_consistency();