-- =============================================================================
-- إصلاح كارثة الفاتورة المعلقة 3247172 + منع تكرارها مستقبلاً
-- =============================================================================

-- (1) إصلاح الـ trigger الجذري auto_link_dio_to_order
--     يُحذف منه كتابة receipt_received - يبقى فقط الربط المنطقي
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_link_dio_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_invoice_external_id text;
BEGIN
  -- إذا الربط موجود سلفاً، لا نفعل شيئاً
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- محاولة 1: مطابقة عبر tracking_number
  SELECT id INTO v_order_id
  FROM orders
  WHERE tracking_number = NEW.external_order_id
    AND status IN ('delivered', 'completed', 'partial_delivery')
    AND delivery_status IN ('4', '5', '21')
  LIMIT 1;

  -- محاولة 2: مطابقة عبر delivery_partner_order_id
  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM orders
    WHERE delivery_partner_order_id = NEW.external_order_id
      AND status IN ('delivered', 'completed', 'partial_delivery')
      AND delivery_status IN ('4', '5', '21')
    LIMIT 1;
  END IF;

  IF v_order_id IS NOT NULL THEN
    -- ربط منطقي فقط
    NEW.order_id := v_order_id;

    -- نكتب delivery_partner_invoice_id فقط للعرض (آمن، لا يُسبب completion)
    SELECT external_id INTO v_invoice_external_id
    FROM delivery_invoices
    WHERE id = NEW.invoice_id;

    UPDATE orders
    SET delivery_partner_invoice_id = v_invoice_external_id
    WHERE id = v_order_id
      AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id <> v_invoice_external_id);

    -- ملاحظة: تعليم receipt_received يحدث حصراً عند received=true للفاتورة
    -- عبر sync_orders_on_invoice_received / ensure_all_invoice_orders_received
  END IF;

  RETURN NEW;
END;
$function$;

-- (2) تنظيف الكارثة الحالية - الفاتورة 3247172
-- =============================================================================
DO $$
DECLARE
  v_invoice_uuid uuid;
  v_affected_order_ids uuid[];
  v_deleted_movements int;
  v_reverted_orders int;
  v_other_invoice_check int;
BEGIN
  -- جلب id الفاتورة 3247172
  SELECT id INTO v_invoice_uuid
  FROM delivery_invoices
  WHERE external_id = '3247172' AND partner = 'alwaseet';

  IF v_invoice_uuid IS NULL THEN
    RAISE NOTICE 'Invoice 3247172 not found - skipping cleanup';
    RETURN;
  END IF;

  -- التأكد أن الفاتورة لا تزال غير مستلمة (شرط أمان)
  IF EXISTS (SELECT 1 FROM delivery_invoices WHERE id = v_invoice_uuid AND received = true) THEN
    RAISE NOTICE 'Invoice 3247172 is now received=true - aborting cleanup';
    RETURN;
  END IF;

  -- جمع الـ order_ids المتأثرة (المعلَّمة خطأً في 2026-04-24 06:20:51.230773)
  SELECT array_agg(o.id) INTO v_affected_order_ids
  FROM orders o
  JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  WHERE dio.invoice_id = v_invoice_uuid
    AND o.receipt_received = true
    AND o.receipt_received_at = '2026-04-24 06:20:51.230773+00'::timestamptz;

  IF v_affected_order_ids IS NULL OR array_length(v_affected_order_ids, 1) = 0 THEN
    RAISE NOTICE 'No affected orders found for invoice 3247172';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % affected orders for invoice 3247172', array_length(v_affected_order_ids, 1);

  -- safety check: تأكد أن الكارثة لم تمتد لفواتير أخرى
  SELECT COUNT(*) INTO v_other_invoice_check
  FROM orders o
  WHERE o.receipt_received_at = '2026-04-24 06:20:51.230773+00'::timestamptz
    AND o.id <> ALL(v_affected_order_ids);

  IF v_other_invoice_check > 0 THEN
    RAISE NOTICE 'WARNING: % additional orders affected by same timestamp - investigate', v_other_invoice_check;
  END IF;

  -- (أ) حذف 12 حركة نقد كاذبة (clean state philosophy)
  DELETE FROM cash_movements
  WHERE reference_type = 'order'
    AND reference_id = ANY(v_affected_order_ids)
    AND movement_type = 'in'
    AND created_at = '2026-04-24 06:20:51.230773+00'::timestamptz;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;
  RAISE NOTICE 'Deleted % erroneous cash movements', v_deleted_movements;

  -- (ب) إعادة الـ 12 طلب: status -> delivered, receipt_received -> false
  UPDATE orders
  SET 
    receipt_received = false,
    receipt_received_at = NULL,
    receipt_received_by = NULL,
    status = 'delivered',
    updated_at = now()
  WHERE id = ANY(v_affected_order_ids);
  GET DIAGNOSTICS v_reverted_orders = ROW_COUNT;
  RAISE NOTICE 'Reverted % orders to delivered+pending', v_reverted_orders;

  -- ملاحظة: لا نلمس delivery_partner_invoice_id (الربط المنطقي صحيح)
  -- لا نلمس delivery_invoice_orders (الربط منطقي صحيح)
  -- profits ستُحدث تلقائياً عبر sync_profit_status_with_receipt
END $$;

-- (3) إعادة حساب رصيد القاصة الرئيسية بعد الحذف
-- =============================================================================
-- استخدام دالة موجودة لو متاحة، أو حساب يدوي آمن
DO $$
DECLARE
  v_cash_source_id uuid := 'f70cfbb5-343a-4a2d-9e36-489beaf29392';
  v_recalc_balance numeric;
  v_initial numeric;
BEGIN
  SELECT initial_balance INTO v_initial
  FROM cash_sources
  WHERE id = v_cash_source_id;

  IF v_initial IS NULL THEN
    RAISE NOTICE 'Cash source not found - skipping recalc';
    RETURN;
  END IF;

  SELECT v_initial + COALESCE(SUM(
    CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
  ), 0)
  INTO v_recalc_balance
  FROM cash_movements
  WHERE cash_source_id = v_cash_source_id;

  UPDATE cash_sources
  SET current_balance = v_recalc_balance, updated_at = now()
  WHERE id = v_cash_source_id;

  RAISE NOTICE 'Cash source rebalanced to %', v_recalc_balance;
END $$;