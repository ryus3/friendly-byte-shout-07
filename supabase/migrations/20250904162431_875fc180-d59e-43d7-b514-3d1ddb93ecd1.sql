-- إصلاح شامل لنظام الفواتير وتنظيف البيانات المتضررة

-- دالة لتنظيف البيانات المتضررة
CREATE OR REPLACE FUNCTION public.fix_corrupted_invoice_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  corrupted_orders_count INTEGER := 0;
  fixed_orders_count INTEGER := 0;
  order_record RECORD;
BEGIN
  -- العثور على الطلبات التي لديها receipt_received = true بدون delivery_partner_invoice_id
  SELECT COUNT(*) INTO corrupted_orders_count
  FROM public.orders
  WHERE receipt_received = true
    AND delivery_partner_invoice_id IS NULL
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet';

  RAISE NOTICE 'تم العثور على % طلب متضرر', corrupted_orders_count;

  -- إصلاح الطلبات المتضررة
  FOR order_record IN 
    SELECT id, order_number, tracking_number, created_by
    FROM public.orders
    WHERE receipt_received = true
      AND delivery_partner_invoice_id IS NULL
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
  LOOP
    -- محاولة العثور على فاتورة مرتبطة
    DECLARE
      linked_invoice_id TEXT;
    BEGIN
      -- البحث في delivery_invoice_orders
      SELECT di.external_id INTO linked_invoice_id
      FROM public.delivery_invoices di
      JOIN public.delivery_invoice_orders dio ON di.id = dio.invoice_id
      WHERE dio.order_id = order_record.id
        AND di.received = true
      LIMIT 1;

      IF linked_invoice_id IS NOT NULL THEN
        -- ربط الطلب بالفاتورة
        UPDATE public.orders
        SET delivery_partner_invoice_id = linked_invoice_id,
            updated_at = now()
        WHERE id = order_record.id;
        
        fixed_orders_count := fixed_orders_count + 1;
        RAISE NOTICE 'تم ربط الطلب % بالفاتورة %', order_record.order_number, linked_invoice_id;
      ELSE
        -- إعادة تعيين حالة استلام الفاتورة إذا لم توجد فاتورة مرتبطة
        UPDATE public.orders
        SET receipt_received = false,
            receipt_received_at = NULL,
            receipt_received_by = NULL,
            -- إعادة الحالة إلى delivered إذا كانت completed وكان الطلب من المدير
            status = CASE 
              WHEN status = 'completed' AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
              THEN 'delivered'
              ELSE status
            END,
            updated_at = now()
        WHERE id = order_record.id;
        
        fixed_orders_count := fixed_orders_count + 1;
        RAISE NOTICE 'تم إعادة تعيين حالة استلام الفاتورة للطلب %', order_record.order_number;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'corrupted_orders_found', corrupted_orders_count,
    'orders_fixed', fixed_orders_count,
    'message', 'تم إصلاح ' || fixed_orders_count || ' طلب من أصل ' || corrupted_orders_count || ' طلب متضرر'
  );
END;
$function$;

-- تحسين دالة handle_receipt_received_order لمنع حدوث نفس المشكلة
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- التحقق من وجود رقم فاتورة فعلي قبل المتابعة
    IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
      RAISE WARNING 'محاولة تعيين receipt_received = true بدون رقم فاتورة للطلب %', COALESCE(NEW.order_number, NEW.id::text);
      -- عدم السماح بتعيين receipt_received = true بدون رقم فاتورة
      NEW.receipt_received := false;
      RETURN NEW;
    END IF;

    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- If the order belongs to the manager/system owner, mark as completed
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      -- Only move forward from delivered to completed
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
        RAISE NOTICE 'تم تحويل طلب المدير % من delivered إلى completed عند استلام الفاتورة %', 
                     COALESCE(NEW.order_number, NEW.id::text), NEW.delivery_partner_invoice_id;
      END IF;
    END IF;
  END IF;

  -- When invoice receipt is set to false, clear the timestamp and related data
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    NEW.receipt_received_at := NULL;
    NEW.receipt_received_by := NULL;
    -- Clear invoice ID when receipt is marked as not received
    NEW.delivery_partner_invoice_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- تحسين دالة sync_recent_received_invoices لضمان سلامة البيانات
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
BEGIN
  FOR invoice_record IN 
    SELECT di.id, di.external_id, di.received_at
    FROM public.delivery_invoices di
    WHERE di.received = true
      AND di.received_at >= now() - interval '30 days'
      AND di.partner = 'alwaseet'
      AND di.external_id IS NOT NULL
      AND TRIM(di.external_id) != ''
    ORDER BY di.received_at DESC
  LOOP
    -- Update orders linked via delivery_invoice_orders
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      -- Auto-complete manager orders that were delivered
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid AND o.status = 'delivered' THEN 'completed'
        ELSE o.status
      END,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = invoice_record.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;

    -- Also update orders linked by delivery_partner_order_id
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid AND o.status = 'delivered' THEN 'completed'
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
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet';

    GET DIAGNOSTICS current_count = ROW_COUNT;
    updated_orders_count := updated_orders_count + current_count;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'skipped_orders_count', skipped_orders_count,
    'message', 'Updated ' || updated_orders_count || ' orders from recent received invoices'
  );
END;
$function$;

-- دالة للتحقق الدوري من سلامة البيانات
CREATE OR REPLACE FUNCTION public.validate_invoice_data_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  total_alwaseet_orders INTEGER;
  orders_with_receipt_received INTEGER;
  orders_with_invoice_id INTEGER;
  inconsistent_orders INTEGER;
BEGIN
  -- إحصائيات عامة لطلبات الوسيط
  SELECT COUNT(*) INTO total_alwaseet_orders
  FROM public.orders
  WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet';

  -- الطلبات التي تم استلام فاتورتها
  SELECT COUNT(*) INTO orders_with_receipt_received
  FROM public.orders
  WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND receipt_received = true;

  -- الطلبات التي لديها رقم فاتورة
  SELECT COUNT(*) INTO orders_with_invoice_id
  FROM public.orders
  WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND delivery_partner_invoice_id IS NOT NULL;

  -- الطلبات غير المتسقة (استلام فاتورة بدون رقم فاتورة)
  SELECT COUNT(*) INTO inconsistent_orders
  FROM public.orders
  WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND receipt_received = true
    AND delivery_partner_invoice_id IS NULL;

  RETURN jsonb_build_object(
    'total_alwaseet_orders', total_alwaseet_orders,
    'orders_with_receipt_received', orders_with_receipt_received,
    'orders_with_invoice_id', orders_with_invoice_id,
    'inconsistent_orders', inconsistent_orders,
    'integrity_status', CASE 
      WHEN inconsistent_orders = 0 THEN 'healthy'
      WHEN inconsistent_orders <= 5 THEN 'warning'
      ELSE 'critical'
    END,
    'timestamp', now()
  );
END;
$function$;