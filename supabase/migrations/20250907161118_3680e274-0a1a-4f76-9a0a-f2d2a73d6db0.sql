
-- 1) إسقاط أي ترايغر/دالة تبسّط الحساب وتسبب تخطي قواعد الأرباح
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt ON public.orders;
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt_trigger ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_calculate_profit_on_receipt ON public.orders;

-- نحذف الدالة المبسّطة إن وُجدت
DROP FUNCTION IF EXISTS public.auto_calculate_profit_on_receipt();

-- 2) إنشاء/تثبيت التريغر الموحد الصحيح الذي يستدعي الدالة rule-based
-- نعيد إنشاء الدالة trigger_calculate_profit_on_receipt بأمان لتتأكد من استدعاء الحساب الصحيح
CREATE OR REPLACE FUNCTION public.trigger_calculate_profit_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received
     AND NEW.receipt_received = true THEN
    PERFORM public.calculate_order_profit_fixed_amounts(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- نحافظ على وجود تريغر واحد فقط مربوط بجدول الطلبات
DROP TRIGGER IF EXISTS calculate_profit_on_receipt_trigger ON public.orders;
CREATE TRIGGER calculate_profit_on_receipt_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_profit_on_receipt();

-- 3) إعادة احتساب أرباح الطلب المحدد ORD000005 (ID معلوم)
SELECT public.calculate_order_profit_fixed_amounts('73e17a6f-85c7-4a1c-a793-d8f9303de037'::uuid);

-- 4) إصلاح جماعي اختياري: إعادة حساب أي أرباح "pending" تم احتسابها بالنسب العامة (وليست 100%)
DO $fix$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.order_id
    FROM public.profits p
    JOIN public.orders o ON o.id = p.order_id
    WHERE o.receipt_received = true
      AND p.status = 'pending'
      AND p.employee_percentage BETWEEN 1 AND 99
  LOOP
    PERFORM public.calculate_order_profit_fixed_amounts(r.order_id);
  END LOOP;
END;
$fix$;
