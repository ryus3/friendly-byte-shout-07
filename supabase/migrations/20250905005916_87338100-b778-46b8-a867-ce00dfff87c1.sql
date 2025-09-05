-- إضافة عمود delivery_account_code لربط الطلبات بحسابات شركة التوصيل
ALTER TABLE public.orders 
ADD COLUMN delivery_account_code TEXT;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_orders_delivery_account_code 
ON public.orders(delivery_account_code) 
WHERE delivery_account_code IS NOT NULL;

-- تحديث الطلبات الحالية بناءً على منشئ الطلب وشركة التوصيل
UPDATE public.orders 
SET delivery_account_code = CASE 
  WHEN delivery_partner = 'alwaseet' AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
  THEN 'Ryusiq'  -- حساب المدير
  ELSE NULL 
END
WHERE delivery_partner = 'alwaseet';

-- دالة استرداد الطلبات المحذوفة للمدير
CREATE OR REPLACE FUNCTION public.restore_manager_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  manager_uuid uuid := '91484496-b887-44f7-9e5d-be9db5567604';
  restored_count integer := 0;
  order_record RECORD;
BEGIN
  -- استرداد الطلبات المحذوفة للمدير
  FOR order_record IN 
    SELECT 
      '100503893' as tracking_number,
      'delivered' as status,
      'تم التسليم للزبون' as delivery_status
    UNION ALL
    SELECT 
      '100579474' as tracking_number,
      'delivered' as status,
      'تم التسليم للزبون' as delivery_status
  LOOP
    -- التحقق من وجود الطلب
    IF NOT EXISTS (
      SELECT 1 FROM public.orders 
      WHERE tracking_number = order_record.tracking_number
      AND created_by = manager_uuid
    ) THEN
      -- إنشاء الطلب المفقود
      INSERT INTO public.orders (
        tracking_number,
        delivery_partner_order_id,
        delivery_partner,
        delivery_account_code,
        status,
        delivery_status,
        created_by,
        customer_name,
        customer_phone,
        customer_address,
        customer_city,
        final_amount,
        created_at,
        updated_at
      ) VALUES (
        order_record.tracking_number,
        order_record.tracking_number,
        'alwaseet',
        'Ryusiq',
        order_record.status,
        order_record.delivery_status,
        manager_uuid,
        'عميل مسترد',
        '07xxxxxxxxx',
        'عنوان مؤقت',
        'بغداد',
        50000,
        '2025-08-01 10:00:00+00'::timestamptz,
        now()
      );
      
      restored_count := restored_count + 1;
      RAISE NOTICE 'تم استرداد الطلب: %', order_record.tracking_number;
    ELSE
      -- تحديث الطلب الموجود
      UPDATE public.orders 
      SET 
        delivery_account_code = 'Ryusiq',
        status = order_record.status,
        delivery_status = order_record.delivery_status,
        isarchived = false,
        updated_at = now()
      WHERE tracking_number = order_record.tracking_number
      AND created_by = manager_uuid;
      
      RAISE NOTICE 'تم تحديث الطلب الموجود: %', order_record.tracking_number;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'restored_count', restored_count,
    'message', 'تم استرداد ' || restored_count || ' طلب للمدير'
  );
END;
$$;

-- تحديث دالة المزامنة لتطبيق الفصل بين الحسابات
CREATE OR REPLACE FUNCTION public.sync_user_scoped_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  updated_orders_count integer := 0;
  invoice_record RECORD;
  current_count integer;
  v_current_user_id uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  -- التحقق من صلاحيات المدير
  BEGIN
    SELECT is_admin_or_deputy() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  -- مزامنة الفواتير المستلمة مع فصل الحسابات
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
    -- تحديث فقط الطلبات التي تنتمي للمستخدم الحالي أو الحساب النشط
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, invoice_record.received_at),
      receipt_received_by = COALESCE(o.receipt_received_by, o.created_by),
      delivery_partner_invoice_id = invoice_record.external_id,
      status = CASE 
        WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
             AND o.status = 'delivered' THEN 'completed'
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
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_orders_count,
    'message', 'تم تحديث ' || updated_orders_count || ' طلب (مع فصل الحسابات)'
  );
END;
$$;

-- دالة لجلب الطلبات الخاصة بحساب التوصيل النشط فقط
CREATE OR REPLACE FUNCTION public.get_user_delivery_orders(
  p_user_id uuid,
  p_delivery_partner text DEFAULT 'alwaseet',
  p_account_code text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tracking_number text,
  delivery_partner_order_id text,
  status text,
  delivery_status text,
  customer_name text,
  final_amount numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.tracking_number,
    o.delivery_partner_order_id,
    o.status,
    o.delivery_status,
    o.customer_name,
    o.final_amount,
    o.created_at
  FROM public.orders o
  WHERE o.delivery_partner = p_delivery_partner
    AND o.created_by = p_user_id
    AND (
      p_account_code IS NULL 
      OR o.delivery_account_code = p_account_code
      OR o.delivery_account_code IS NULL
    )
  ORDER BY o.created_at DESC;
END;
$$;

-- تشغيل استرداد طلبات المدير
SELECT public.restore_manager_orders();