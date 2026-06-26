
-- ============================================================
-- 1) تحديث record_order_revenue_on_receipt:
--    استخدم مبلغ سطر الفاتورة كمصدر حقيقة، وتجاهل off-channel (amount=0) والإرجاعات
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_amount NUMERIC;
  v_delivery_fee NUMERIC;
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_dio_amount NUMERIC;
  v_dio_found BOOLEAN := false;
  v_owner_id UUID;
BEGIN
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN

    -- استبعاد الإرجاعات/الإلغاءات (تُعالج بترايغر مستقل على delivery_invoice_orders)
    IF NEW.status IN ('returned','cancelled','rejected') OR COALESCE(NEW.order_type,'regular') = 'return' THEN
      RETURN NEW;
    END IF;

    -- منع التكرار
    IF EXISTS(
      SELECT 1 FROM cash_movements
      WHERE reference_id = NEW.id
        AND reference_type IN ('order','order_revenue','order_income')
    ) THEN
      RETURN NEW;
    END IF;

    v_delivery_fee := COALESCE(NEW.delivery_fee, 0);

    -- اقرأ مبلغ سطر الفاتورة (مصدر الحقيقة الفعلي)
    SELECT dio.amount INTO v_dio_amount
    FROM public.delivery_invoice_orders dio
    WHERE dio.order_id = NEW.id
    LIMIT 1;
    v_dio_found := FOUND;

    IF v_dio_found THEN
      -- off-channel: المبلغ = 0 ⇒ لا حركة نقد. سيُنشئ trg_auto_detect_off_channel سجلاً للمالك.
      IF COALESCE(v_dio_amount, 0) = 0 THEN
        RETURN NEW;
      END IF;
      -- صافي النقد = مبلغ الفاتورة − رسوم التوصيل (للبيع العادي والجزئي)
      v_sales_amount := v_dio_amount - v_delivery_fee;
    ELSE
      -- لا يوجد سطر فاتورة بعد: استخدم final_amount (يحدث للطلبات اليدوية فقط)
      v_sales_amount := COALESCE(NEW.final_amount, 0) - v_delivery_fee;
    END IF;

    IF v_sales_amount = 0 THEN
      RETURN NEW;
    END IF;

    -- اختيار قاصة: قاصة مالك أحد منتجات الطلب أولاً، ثم القاصة الرئيسية
    SELECT DISTINCT p.owner_user_id INTO v_owner_id
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id AND p.owner_user_id IS NOT NULL
    LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
      SELECT id INTO v_cash_source_id FROM public.cash_sources
      WHERE owner_user_id = v_owner_id AND is_active = true LIMIT 1;
    END IF;

    IF v_cash_source_id IS NULL THEN
      SELECT id INTO v_cash_source_id FROM public.cash_sources
      WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;

    IF v_cash_source_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد مصدر نقد نشط';
    END IF;

    SELECT current_balance INTO v_balance_before FROM public.cash_sources WHERE id = v_cash_source_id;
    v_balance_after := v_balance_before + v_sales_amount;

    INSERT INTO public.cash_movements (
      cash_source_id, movement_type, reference_type, reference_id, amount,
      balance_before, balance_after, description, created_by, effective_at
    ) VALUES (
      v_cash_source_id,
      CASE WHEN v_sales_amount >= 0 THEN 'in' ELSE 'out' END,
      'order', NEW.id, ABS(v_sales_amount),
      v_balance_before, v_balance_after,
      'إيراد من طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
      COALESCE(NEW.receipt_received_by, NEW.created_by),
      COALESCE(NEW.receipt_received_at, now())
    );

    UPDATE public.cash_sources SET current_balance = v_balance_after WHERE id = v_cash_source_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2) ترايغر مخصّص للإرجاعات على delivery_invoice_orders:
--    عند ربط/تحديث سطر فاتورة بمبلغ سالب ⇒ سجّل حركة نقد سالبة (خسارة المنتج + التوصيل)
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_order_return_on_invoice_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_invoice RECORD;
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_delta NUMERIC;
  v_owner_id UUID;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.amount, 0) >= 0 THEN RETURN NEW; END IF;

  -- منع التكرار
  IF EXISTS(
    SELECT 1 FROM public.cash_movements
    WHERE reference_id = NEW.order_id AND reference_type = 'order_return'
  ) THEN RETURN NEW; END IF;

  SELECT id, tracking_number, order_number, delivery_fee, created_by, order_type, status
    INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- لا تسجل إلا بعد استلام الفاتورة فعلياً
  SELECT received_at, status INTO v_invoice FROM public.delivery_invoices WHERE id = NEW.invoice_id;
  IF v_invoice.received_at IS NULL THEN RETURN NEW; END IF;

  -- صافي الخسارة = |amount| + delivery_fee
  v_delta := -(ABS(NEW.amount) + COALESCE(v_order.delivery_fee, 0));

  -- اختر قاصة مالك المنتج إن وجد، وإلا قاصة المنشئ، وإلا الرئيسية
  SELECT DISTINCT p.owner_user_id INTO v_owner_id
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.order_id AND p.owner_user_id IS NOT NULL
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    SELECT id INTO v_cash_source_id FROM public.cash_sources
    WHERE owner_user_id = v_owner_id AND is_active = true LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN
    SELECT id INTO v_cash_source_id FROM public.cash_sources
    WHERE is_active = true ORDER BY created_at LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN RETURN NEW; END IF;

  SELECT current_balance INTO v_balance_before FROM public.cash_sources WHERE id = v_cash_source_id;
  v_balance_after := v_balance_before + v_delta;

  INSERT INTO public.cash_movements (
    cash_source_id, movement_type, reference_type, reference_id, amount,
    balance_before, balance_after, description, created_by, effective_at
  ) VALUES (
    v_cash_source_id, 'out', 'order_return', NEW.order_id, ABS(v_delta),
    v_balance_before, v_balance_after,
    'استرجاع طلب ' || COALESCE(v_order.tracking_number, v_order.order_number),
    v_order.created_by, COALESCE(v_invoice.received_at, now())
  );

  UPDATE public.cash_sources SET current_balance = v_balance_after WHERE id = v_cash_source_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_order_return_on_invoice_link ON public.delivery_invoice_orders;
CREATE TRIGGER trg_record_order_return_on_invoice_link
  AFTER INSERT OR UPDATE ON public.delivery_invoice_orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_return_on_invoice_link();

-- ============================================================
-- 3) إشعار المالك تلقائياً عند pending_owner_confirmation
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_owner_off_channel_pending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tracking TEXT;
BEGIN
  IF NEW.status = 'pending_owner_confirmation'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.owner_user_id IS NOT NULL THEN

    SELECT COALESCE(tracking_number, order_number) INTO v_tracking FROM public.orders WHERE id = NEW.order_id;

    INSERT INTO public.notifications (
      user_id, title, message, type, priority, data, related_entity_id, auto_delete
    ) VALUES (
      NEW.owner_user_id,
      'تأكيد استلام تحصيل خارج القناة',
      'بانتظار تأكيدك استلام ' || COALESCE(NEW.owner_due_amount,0)::text || ' د.ع من الطلب ' || COALESCE(v_tracking,'—'),
      'off_channel_pending_confirmation',
      'high',
      jsonb_build_object(
        'off_channel_id', NEW.id,
        'order_id', NEW.order_id,
        'amount', NEW.owner_due_amount,
        'link', '/off-channel-inbox'
      ),
      NEW.id::text,
      false
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_owner_off_channel ON public.off_channel_collections;
CREATE TRIGGER trg_notify_owner_off_channel
  AFTER INSERT OR UPDATE OF status ON public.off_channel_collections
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_off_channel_pending();

-- ============================================================
-- 4) عند settled: أنشئ حركة نقد للمالك تلقائياً (إن لم تكن مُنشأة)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_off_channel_cash_movement_on_settle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

    SELECT id INTO v_cs FROM public.cash_sources
     WHERE owner_user_id = NEW.owner_user_id AND is_active = true
     ORDER BY is_main DESC NULLS LAST, created_at LIMIT 1;

    IF v_cs IS NULL THEN
      SELECT id INTO v_cs FROM public.cash_sources
       WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_cs IS NULL THEN RETURN NEW; END IF;

    SELECT COALESCE(tracking_number, order_number) INTO v_tracking FROM public.orders WHERE id = NEW.order_id;
    SELECT current_balance INTO v_balance_before FROM public.cash_sources WHERE id = v_cs;
    v_balance_after := v_balance_before + NEW.owner_due_amount;

    INSERT INTO public.cash_movements (
      cash_source_id, movement_type, reference_type, reference_id, amount,
      balance_before, balance_after, description, created_by, effective_at
    ) VALUES (
      v_cs, 'in', 'off_channel_receipt', NEW.order_id, NEW.owner_due_amount,
      v_balance_before, v_balance_after,
      'تحصيل خارج القناة - طلب ' || COALESCE(v_tracking,'—'),
      NEW.owner_user_id, now()
    ) RETURNING id INTO v_cm_id;

    UPDATE public.cash_sources SET current_balance = v_balance_after WHERE id = v_cs;
    NEW.cash_movement_id := v_cm_id;
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_off_channel_settle_cash ON public.off_channel_collections;
CREATE TRIGGER trg_off_channel_settle_cash
  BEFORE UPDATE OF status ON public.off_channel_collections
  FOR EACH ROW EXECUTE FUNCTION public.create_off_channel_cash_movement_on_settle();

-- ============================================================
-- 5) auto_detect_off_channel: استبعد الإرجاع والتسليم الجزئي والاستبدال صراحةً
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_detect_off_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.amount, 0) <> 0 THEN RETURN NEW; END IF;

  SELECT o.id, o.order_type, o.status, o.delivery_status, o.delivery_fee, o.created_by, o.final_amount
    INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF COALESCE(v_order.order_type,'regular') NOT IN ('regular') THEN RETURN NEW; END IF;
  IF v_order.status IN ('returned','cancelled','rejected') THEN RETURN NEW; END IF;
  IF v_order.delivery_status::text <> '4' THEN RETURN NEW; END IF;

  INSERT INTO public.off_channel_collections (
    order_id, invoice_id, collector_user_id, owner_user_id,
    delivery_fee_absorbed, customer_paid_amount, status
  ) VALUES (
    NEW.order_id, NEW.invoice_id, v_order.created_by, NEW.owner_user_id,
    COALESCE(v_order.delivery_fee, 0),
    COALESCE(v_order.final_amount, 0),
    'pending_classification'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END $$;
