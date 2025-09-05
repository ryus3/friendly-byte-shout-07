
-- 1) تقييد مزامنة الفواتير الحديثة لتكون ضمن مالك الفاتورة/المستخدم الحالي فقط
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated_orders_count integer := 0;
  skipped_orders_count integer := 0;
  invoice_record RECORD;
  current_count integer;
  v_current_user_id uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  -- السماح للمدير باستخدام شامل، وباقي المستخدمين مقيدون بمالك الفاتورة
  BEGIN
    SELECT is_admin_or_deputy() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  FOR invoice_record IN 
    SELECT di.id, di.external_id, di.received_at
    FROM public.delivery_invoices di
    WHERE di.received = true
      AND di.received_at >= now() - interval '30 days'
      AND di.partner = 'alwaseet'
      AND di.external_id IS NOT NULL
      AND TRIM(di.external_id) <> ''
      AND (
        v_is_admin
        OR di.owner_user_id = v_current_user_id
      )
    ORDER BY di.received_at DESC
  LOOP
    -- تحديث الطلبات المرتبطة عبر delivery_invoice_orders مع تقييد المالك
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN v_is_admin = true
             AND o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
             AND o.status = 'delivered' THEN 'completed'
        WHEN v_is_admin = false
             AND o.created_by = v_current_user_id
             AND o.status = 'delivered'
             AND o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN 'completed'
        ELSE o.status
      END,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false
      AND (
        v_is_admin
        OR o.created_by = v_current_user_id
      );

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;

    -- تحديث الطلبات المرتبطة عبر delivery_partner_order_id مع نفس التقييد
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN v_is_admin = true
             AND o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
             AND o.status = 'delivered' THEN 'completed'
        WHEN v_is_admin = false
             AND o.created_by = v_current_user_id
             AND o.status = 'delivered'
             AND o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN 'completed'
        ELSE o.status
      END,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = invoice_record.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND (
        v_is_admin
        OR o.created_by = v_current_user_id
      );

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'skipped_orders_count', skipped_orders_count,
    'message', 'Updated ' || updated_orders_count || ' orders from recent received invoices (scoped by owner)'
  );
END;
$function$;

-- 2) تقييد Trigger الذي ينسخ حالة استلام الفاتورة إلى الطلبات ليحترم مالك الفاتورة
CREATE OR REPLACE FUNCTION public.propagate_invoice_received_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner uuid;
  v_is_admin boolean := false;
BEGIN
  v_owner := COALESCE(NEW.owner_user_id, auth.uid());

  BEGIN
    SELECT is_admin_or_deputy() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  -- عندما تصبح الفاتورة مستلمة
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(v_owner, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = false
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );

    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(v_owner, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );
  END IF;

  -- عند إلغاء الاستلام
  IF NEW.received = false AND COALESCE(OLD.received, false) = true THEN
    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );

    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );
  END IF;

  RETURN NEW;
END;
$function$;
