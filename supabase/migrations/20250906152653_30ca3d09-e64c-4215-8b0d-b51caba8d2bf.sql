-- إصلاح نظام المزامنة الشاملة وضمان المزامنة التلقائية المجدولة

-- 1. تحديث دالة مزامنة حديثة للطلبات بدون حذف
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  updated_orders_count integer := 0;
  processed_invoices_count integer := 0;
  invoice_record record;
  order_record record;
BEGIN
  -- مزامنة الطلبات من الفواتير المستلمة فقط (بدون حذف)
  FOR invoice_record IN 
    SELECT DISTINCT di.id, di.external_id, di.owner_user_id
    FROM public.delivery_invoices di
    WHERE di.partner = 'alwaseet'
      AND di.received = true
      AND di.issued_at >= now() - interval '30 days'
  LOOP
    processed_invoices_count := processed_invoices_count + 1;
    
    -- تحديث الطلبات المرتبطة بالفاتورة (تحديث فقط، بدون حذف)
    FOR order_record IN
      SELECT o.id, o.delivery_partner_order_id, o.tracking_number
      FROM public.orders o
      JOIN public.delivery_invoice_orders dio ON dio.order_id = o.id
      WHERE dio.invoice_id = invoice_record.id
        AND o.delivery_partner = 'alwaseet'
        AND o.receipt_received = false
    LOOP
      -- تحديث حالة استلام الفاتورة للطلب
      UPDATE public.orders
      SET 
        receipt_received = true,
        receipt_received_at = COALESCE(receipt_received_at, now()),
        delivery_partner_invoice_id = invoice_record.external_id,
        updated_at = now()
      WHERE id = order_record.id;
      
      updated_orders_count := updated_orders_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'processed_invoices_count', processed_invoices_count,
    'message', 'تم تحديث ' || updated_orders_count || ' طلب من ' || processed_invoices_count || ' فاتورة'
  );
END;
$function$;

-- 2. إنشاء دالة مزامنة ذكية للطلب المحدد 101032342
CREATE OR REPLACE FUNCTION public.sync_specific_order_by_tracking(p_tracking_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  order_found boolean := false;
  order_id_found uuid;
  current_status text;
  current_delivery_status text;
BEGIN
  -- البحث عن الطلب بالرقم المحدد
  SELECT id, status, delivery_status
  INTO order_id_found, current_status, current_delivery_status
  FROM public.orders
  WHERE tracking_number = p_tracking_number
     OR delivery_partner_order_id = p_tracking_number
     OR order_number = p_tracking_number
  LIMIT 1;

  IF order_id_found IS NOT NULL THEN
    order_found := true;
    
    -- إذا كانت الحالة لا تزال 'فعال' أو نصية، حدثها للحالة المناسبة
    IF current_delivery_status = 'فعال' OR current_delivery_status = '1' THEN
      UPDATE public.orders
      SET 
        delivery_status = '1',
        status = 'pending',
        updated_at = now()
      WHERE id = order_id_found;
      
      RAISE NOTICE 'تم تحديث الطلب % - الحالة: pending', p_tracking_number;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_found', order_found,
    'order_id', order_id_found,
    'current_status', current_status,
    'current_delivery_status', current_delivery_status,
    'message', CASE 
      WHEN order_found THEN 'تم العثور على الطلب وتحديثه: ' || p_tracking_number
      ELSE 'لم يتم العثور على الطلب: ' || p_tracking_number
    END
  );
END;
$function$;

-- 3. تحديث إعدادات المزامنة التلقائية المجدولة
INSERT INTO public.invoice_sync_settings (
  id,
  daily_sync_enabled,
  sync_frequency,
  morning_sync_time,
  evening_sync_time,
  lookback_days,
  auto_cleanup_enabled,
  keep_invoices_per_employee
) VALUES (
  gen_random_uuid(),
  true,
  'twice_daily',
  '09:00:00',
  '21:00:00',
  30,
  true,
  10
) ON CONFLICT DO NOTHING;

-- 4. إنشاء دالة تنظيف الفواتير القديمة مع الاحتفاظ بـ 10 فقط
CREATE OR REPLACE FUNCTION public.cleanup_old_delivery_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  deleted_count integer := 0;
  employee_record record;
  keep_count integer := 10;
BEGIN
  -- تنظيف فواتير كل موظف على حدة
  FOR employee_record IN 
    SELECT DISTINCT owner_user_id 
    FROM public.delivery_invoices 
    WHERE partner = 'alwaseet' 
      AND owner_user_id IS NOT NULL
  LOOP
    -- حذف الفواتير الزائدة عن 10 لكل موظف
    WITH ranked_invoices AS (
      SELECT id,
             ROW_NUMBER() OVER (
               ORDER BY COALESCE(issued_at, created_at) DESC
             ) as rn
      FROM public.delivery_invoices
      WHERE owner_user_id = employee_record.owner_user_id
        AND partner = 'alwaseet'
    ),
    deleted AS (
      DELETE FROM public.delivery_invoices 
      WHERE id IN (
        SELECT id FROM ranked_invoices WHERE rn > keep_count
      )
      RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'keep_count', keep_count,
    'message', 'تم حذف ' || deleted_count || ' فاتورة قديمة'
  );
END;
$function$;

-- 5. تشغيل دالة مزامنة الطلب المحدد
SELECT public.sync_specific_order_by_tracking('101032342');

COMMENT ON FUNCTION public.sync_recent_received_invoices() IS 'مزامنة الطلبات من الفواتير المستلمة بدون حذف';
COMMENT ON FUNCTION public.sync_specific_order_by_tracking(text) IS 'مزامنة طلب محدد بالرقم';
COMMENT ON FUNCTION public.cleanup_old_delivery_invoices() IS 'تنظيف الفواتير القديمة مع الاحتفاظ بـ 10 فقط لكل موظف';