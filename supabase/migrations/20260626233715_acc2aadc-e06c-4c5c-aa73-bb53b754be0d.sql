
CREATE OR REPLACE FUNCTION public.create_off_channel_cash_movement_on_settle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cs UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_cm_id UUID;
  v_tracking TEXT;
BEGIN
  IF NEW.status = 'settled' AND (OLD.status IS DISTINCT FROM 'settled')
     AND COALESCE(NEW.owner_due_amount, 0) > 0
     AND NEW.cash_movement_id IS NULL THEN

    -- اختيار القاصة: قاصة المالك النشطة → القاصة الرئيسية (owner_user_id IS NULL) → أي قاصة نشطة
    SELECT id INTO v_cs FROM public.cash_sources
     WHERE owner_user_id = NEW.owner_user_id AND is_active = true
     ORDER BY created_at LIMIT 1;

    IF v_cs IS NULL THEN
      SELECT id INTO v_cs FROM public.cash_sources
       WHERE owner_user_id IS NULL AND is_active = true
       ORDER BY created_at LIMIT 1;
    END IF;

    IF v_cs IS NULL THEN
      SELECT id INTO v_cs FROM public.cash_sources
       WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_cs IS NULL THEN RETURN NEW; END IF;

    SELECT COALESCE(tracking_number, order_number) INTO v_tracking FROM public.orders WHERE id = NEW.order_id;
    SELECT current_balance INTO v_balance_before FROM public.cash_sources WHERE id = v_cs;
    v_balance_after := COALESCE(v_balance_before, 0) + NEW.owner_due_amount;

    INSERT INTO public.cash_movements (
      cash_source_id, movement_type, reference_type, reference_id, amount,
      balance_before, balance_after, description, created_by, effective_at
    ) VALUES (
      v_cs, 'in', 'off_channel_receipt', NEW.order_id, NEW.owner_due_amount,
      COALESCE(v_balance_before, 0), v_balance_after,
      'تحصيل خارج القناة - طلب ' || COALESCE(v_tracking,'—'),
      NEW.owner_user_id, now()
    ) RETURNING id INTO v_cm_id;

    UPDATE public.cash_sources SET current_balance = v_balance_after WHERE id = v_cs;
    NEW.cash_movement_id := v_cm_id;
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END $function$;
