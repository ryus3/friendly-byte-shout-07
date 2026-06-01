-- إعداد جديد
INSERT INTO public.settings (key, value, description)
VALUES (
  'ai_approval_send_as',
  '"creator"'::jsonb,
  'creator = أرسل الطلب الذكي بحساب منشئ الطلب الأصلي في شركة التوصيل (موصى به). approver = بحساب من ضغط الموافقة.'
)
ON CONFLICT (key) DO NOTHING;

-- نحذف الدالة القديمة ذات الاسم المتعارض قبل إنشاء الجديدة
DROP FUNCTION IF EXISTS public.recalculate_cash_source_balance(uuid);

CREATE FUNCTION public.recalculate_cash_source_balance(p_cash_source_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initial numeric := 0;
  v_in numeric := 0;
  v_out numeric := 0;
  v_final numeric := 0;
BEGIN
  SELECT COALESCE(initial_balance, 0) INTO v_initial
  FROM public.cash_sources WHERE id = p_cash_source_id;

  SELECT COALESCE(SUM(CASE WHEN movement_type = 'in' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN movement_type = 'out' THEN amount ELSE 0 END), 0)
    INTO v_in, v_out
  FROM public.cash_movements
  WHERE cash_source_id = p_cash_source_id;

  v_final := v_initial + v_in - v_out;

  UPDATE public.cash_sources
     SET current_balance = v_final,
         updated_at = now()
   WHERE id = p_cash_source_id;

  RETURN v_final;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_cash_source_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_cash_source_balance(OLD.cash_source_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cash_movements_after_delete_recalc ON public.cash_movements;
CREATE TRIGGER cash_movements_after_delete_recalc
AFTER DELETE ON public.cash_movements
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalc_cash_source_after_delete();

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.cash_sources LOOP
    PERFORM public.recalculate_cash_source_balance(r.id);
  END LOOP;
END $$;