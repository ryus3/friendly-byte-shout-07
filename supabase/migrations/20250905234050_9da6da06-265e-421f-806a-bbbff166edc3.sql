-- إصلاح دالة تطبيع حالة الفواتير لتحديد الفواتير المستلمة بشكل صحيح
CREATE OR REPLACE FUNCTION public.normalize_delivery_invoice_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- إصلاح منطق تحديد الفواتير المستلمة - فقط النص الدقيق للاستلام
  IF COALESCE(TRIM(NEW.status), '') = '' THEN
    NEW.status_normalized := COALESCE(NEW.status_normalized, 'SENT');
  ELSE
    -- فقط النص الدقيق "تم الاستلام من قبل التاجر" يعتبر مستلم
    IF NEW.status = 'تم الاستلام من قبل التاجر' THEN
      NEW.status_normalized := 'RECEIVED';
    ELSIF NEW.status ~* 'مسودة|draft' THEN
      NEW.status_normalized := 'DRAFT';
    ELSE
      -- جميع الحالات الأخرى (بما في ذلك "تم قبول استلام الفاتورة") تعتبر SENT
      NEW.status_normalized := 'SENT';
    END IF;
  END IF;

  -- تحديد received_flag بناءً على النص الدقيق فقط
  NEW.received_flag := (NEW.status = 'تم الاستلام من قبل التاجر') OR COALESCE(NEW.received, false);

  -- تطبيق received column بناءً على received_flag
  NEW.received := NEW.received_flag;

  -- إدارة received_at - إزالته إذا لم تكن الفاتورة مستلمة فعلاً
  IF NEW.received_flag = true AND NEW.received_at IS NULL THEN
    NEW.received_at := now();
  ELSIF NEW.received_flag = false THEN
    NEW.received_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- إصلاح الفاتورة 1849184 وجميع الفواتير المشابهة
UPDATE public.delivery_invoices 
SET 
  received = false,
  received_flag = false,
  status_normalized = 'SENT',
  received_at = NULL,
  updated_at = now()
WHERE partner = 'alwaseet' 
  AND received = true 
  AND status != 'تم الاستلام من قبل التاجر'
  AND (status = 'تم قبول استلام الفاتورة' OR status !~ 'تم الاستلام من قبل التاجر');

-- دالة محسنة لمزامنة الفواتير مع تنظيف تلقائي
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list_with_strict_cleanup(p_invoices jsonb, p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item jsonb;
  v_id text;
  v_amount numeric;
  v_count int;
  v_status text;
  v_merchant_id text;
  v_updated_at timestamptz;
  v_upserts int := 0;
  v_keep_count int := 10;
BEGIN
  -- الحصول على عدد الفواتير المراد الاحتفاظ بها من الإعدادات
  SELECT COALESCE(keep_invoices_per_employee, 10) INTO v_keep_count
  FROM public.invoice_sync_settings
  LIMIT 1;

  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- معالجة كل فاتورة
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_id := v_item->>'id';
    v_amount := COALESCE((v_item->>'merchant_price')::numeric, 0);
    v_count := COALESCE((v_item->>'delivered_orders_count')::int, 0);
    v_status := v_item->>'status';
    v_merchant_id := v_item->>'merchant_id';
    v_updated_at := COALESCE(NULLIF(v_item->>'updated_at','')::timestamptz, now());

    INSERT INTO public.delivery_invoices (
      external_id, partner, amount, orders_count, status, merchant_id,
      issued_at, last_api_updated_at, raw, owner_user_id
    ) VALUES (
      v_id, 'alwaseet', v_amount, v_count, v_status, v_merchant_id,
      v_updated_at, v_updated_at, v_item, p_employee_id
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      status = EXCLUDED.status,
      merchant_id = EXCLUDED.merchant_id,
      issued_at = COALESCE(EXCLUDED.issued_at, public.delivery_invoices.issued_at, now()),
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, public.delivery_invoices.last_api_updated_at),
      raw = EXCLUDED.raw,
      owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();

    v_upserts := v_upserts + 1;
  END LOOP;

  -- تنظيف الفواتير القديمة للموظف مع الاحتفاظ بآخر v_keep_count فواتير
  WITH ranked_invoices AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY owner_user_id 
             ORDER BY COALESCE(issued_at, created_at) DESC, created_at DESC
           ) as rn
    FROM public.delivery_invoices
    WHERE owner_user_id = p_employee_id
      AND partner = 'alwaseet'
  )
  DELETE FROM public.delivery_invoices 
  WHERE id IN (
    SELECT id FROM ranked_invoices WHERE rn > v_keep_count
  );

  RETURN jsonb_build_object(
    'success', true, 
    'processed', v_upserts,
    'employee_id', p_employee_id,
    'kept_invoices', v_keep_count
  );
END;
$function$;

-- دالة لمزامنة بيانات الفاتورة مع الطلبات المربوطة
CREATE OR REPLACE FUNCTION public.sync_alwaseet_invoice_data(p_invoice_data jsonb, p_orders_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invoice_id uuid;
  order_data jsonb;
  local_order_id uuid;
  linked_orders_count integer := 0;
  total_orders_count integer := 0;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- البحث عن الفاتورة الموجودة أو إنشاؤها
  INSERT INTO public.delivery_invoices (
    external_id,
    partner,
    amount,
    orders_count,
    issued_at,
    status,
    raw,
    owner_user_id
  ) VALUES (
    p_invoice_data->>'id',
    'alwaseet',
    COALESCE((p_invoice_data->>'merchant_price')::numeric, 0),
    COALESCE((p_invoice_data->>'delivered_orders_count')::integer, 0),
    COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()),
    p_invoice_data->>'status',
    p_invoice_data,
    v_current_user_id
  )
  ON CONFLICT (external_id, partner) DO UPDATE SET
    amount = EXCLUDED.amount,
    orders_count = EXCLUDED.orders_count,
    status = EXCLUDED.status,
    raw = EXCLUDED.raw,
    owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
    updated_at = now()
  RETURNING id INTO v_invoice_id;

  -- معالجة كل طلب في الفاتورة
  FOR order_data IN SELECT * FROM jsonb_array_elements(p_orders_data)
  LOOP
    total_orders_count := total_orders_count + 1;
    
    -- البحث عن الطلب المحلي
    SELECT id INTO local_order_id
    FROM public.orders 
    WHERE (
      delivery_partner_order_id = (order_data->>'id')::text OR
      tracking_number = (order_data->>'id')::text
    )
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND (created_by = v_current_user_id OR is_admin_or_deputy())
    LIMIT 1;
    
    -- إدراج أو تحديث طلب الفاتورة
    INSERT INTO public.delivery_invoice_orders (
      invoice_id,
      order_id,
      external_order_id,
      raw,
      owner_user_id
    ) VALUES (
      v_invoice_id,
      local_order_id,
      order_data->>'id',
      order_data,
      v_current_user_id
    )
    ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      raw = EXCLUDED.raw,
      owner_user_id = COALESCE(public.delivery_invoice_orders.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();
    
    IF local_order_id IS NOT NULL THEN
      linked_orders_count := linked_orders_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'total_orders', total_orders_count,
    'linked_orders', linked_orders_count
  );
END;
$function$;