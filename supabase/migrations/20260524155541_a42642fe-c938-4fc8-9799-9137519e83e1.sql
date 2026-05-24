
-- Trigger: protect partial_delivery orders from having final_amount overwritten by stale callers
CREATE OR REPLACE FUNCTION public.protect_partial_delivery_final_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_confirmed NUMERIC;
BEGIN
  -- يطبّق فقط على طلبات التسليم الجزئي
  IF COALESCE(NEW.order_type, '') <> 'partial_delivery' THEN
    RETURN NEW;
  END IF;

  -- جلب الإيراد المؤكد من سجل التسليم الجزئي (الأحدث)
  SELECT delivered_revenue INTO v_confirmed
  FROM public.partial_delivery_history
  WHERE order_id = NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- لا يوجد سجل بعد → اترك القيمة كما يكتبها التطبيق
  IF v_confirmed IS NULL THEN
    RETURN NEW;
  END IF;

  -- إن حاول كائن خارجي تخفيض final_amount دون قيمتها المؤكدة، أعِدها للقيمة الصحيحة
  IF NEW.final_amount IS DISTINCT FROM v_confirmed THEN
    NEW.final_amount := v_confirmed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_partial_delivery_final_amount ON public.orders;
CREATE TRIGGER trg_protect_partial_delivery_final_amount
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_partial_delivery_final_amount();
