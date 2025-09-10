-- حماية عدم تصفير أجور التوصيل لطلبات الوسيط + تصحيح ORD000013

-- 1) دالة التحقق
CREATE OR REPLACE FUNCTION public.prevent_zero_delivery_fee_for_alwaseet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- لا تسمح بإعادة تعيين أجور التوصيل إلى 0 إذا كانت مثبتة سابقًا (>0) لطلبات AlWaseet
  IF lower(coalesce(NEW.delivery_partner, '')) = 'alwaseet'
     AND COALESCE(NEW.delivery_fee, 0) = 0
     AND COALESCE(OLD.delivery_fee, 0) > 0 THEN
    NEW.delivery_fee := OLD.delivery_fee;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) التريغر
DROP TRIGGER IF EXISTS trg_prevent_zero_delivery_fee_alwaseet ON public.orders;
CREATE TRIGGER trg_prevent_zero_delivery_fee_alwaseet
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_zero_delivery_fee_for_alwaseet();

-- 3) تصحيح أجور التوصيل الحالية للطلب المطلوب
UPDATE public.orders
SET delivery_fee = 5000,
    updated_at = now()
WHERE order_number = 'ORD000013';