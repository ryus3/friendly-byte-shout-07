-- إضافة عمود owner_user_id للجداول لتمييز فواتير كل مستخدم
ALTER TABLE public.delivery_invoices 
ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.delivery_invoice_orders 
ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);

-- إضافة فهارس للأداء
CREATE INDEX idx_delivery_invoices_owner_user_id ON public.delivery_invoices(owner_user_id);
CREATE INDEX idx_delivery_invoice_orders_owner_user_id ON public.delivery_invoice_orders(owner_user_id);

-- تحديث السياسات لتدعم النظام متعدد المستخدمين
DROP POLICY IF EXISTS "Authenticated can view delivery_invoices" ON public.delivery_invoices;

CREATE POLICY "المستخدمون يرون فواتيرهم والمديرون يرون كل شيء" ON public.delivery_invoices
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid() OR 
    is_admin_or_deputy() OR
    owner_user_id IS NULL  -- للفواتير القديمة
  )
);

CREATE POLICY "المستخدمون المصرح لهم يديرون الفواتير" ON public.delivery_invoices
FOR ALL USING (auth.uid() IS NOT NULL);

-- سياسات delivery_invoice_orders
CREATE POLICY "المستخدمون يرون طلبات فواتيرهم والمديرون يرون كل شيء" ON public.delivery_invoice_orders
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid() OR 
    is_admin_or_deputy() OR
    owner_user_id IS NULL  -- للطلبات القديمة
  )
);

CREATE POLICY "المستخدمون المصرح لهم يديرون طلبات الفواتير" ON public.delivery_invoice_orders
FOR ALL USING (auth.uid() IS NOT NULL);

-- تحديث دالة upsert_alwaseet_invoice_list لحفظ owner_user_id
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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
  v_current_user_id uuid := auth.uid();
BEGIN
  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_id := v_item->>'id';
    v_amount := COALESCE((v_item->>'merchant_price')::numeric, 0);
    v_count := COALESCE((v_item->>'delivered_orders_count')::int, 0);
    v_status := v_item->>'status';
    v_merchant_id := v_item->>'merchant_id';
    v_updated_at := NULLIF(v_item->>'updated_at','')::timestamptz;

    INSERT INTO public.delivery_invoices (
      external_id, partner, amount, orders_count, status, merchant_id, issued_at,
      last_api_updated_at, raw, owner_user_id
    ) VALUES (
      v_id, 'alwaseet', v_amount, v_count, v_status, v_merchant_id, v_updated_at,
      v_updated_at, v_item, v_current_user_id
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      status = EXCLUDED.status,
      merchant_id = EXCLUDED.merchant_id,
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, public.delivery_invoices.last_api_updated_at),
      raw = EXCLUDED.raw,
      -- تحديث owner_user_id فقط إذا كان فارغاً (للفواتير القديمة)
      owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();

    v_upserts := v_upserts + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_upserts);
END;
$function$;

-- تحديث دالة sync_alwaseet_invoice_data لحفظ owner_user_id
CREATE OR REPLACE FUNCTION public.sync_alwaseet_invoice_data(p_invoice_data jsonb, p_orders_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  invoice_id uuid;
  order_data jsonb;
  local_order_id uuid;
  linked_orders_count integer := 0;
  total_orders_count integer := 0;
  invoice_received boolean;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- Check if invoice status indicates it's received
  invoice_received := (p_invoice_data->>'status') = 'تم الاستلام من قبل التاجر';
  
  -- Insert or update the delivery invoice
  INSERT INTO public.delivery_invoices (
    external_id,
    partner,
    amount,
    orders_count,
    issued_at,
    received,
    received_at,
    status,
    raw,
    owner_user_id
  ) VALUES (
    p_invoice_data->>'id',
    'alwaseet',
    COALESCE((p_invoice_data->>'merchant_price')::numeric, 0),
    COALESCE((p_invoice_data->>'delivered_orders_count')::integer, 0),
    COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()),
    invoice_received,
    CASE WHEN invoice_received THEN COALESCE((p_invoice_data->>'updated_at')::timestamp with time zone, now()) ELSE NULL END,
    p_invoice_data->>'status',
    p_invoice_data,
    v_current_user_id
  )
  ON CONFLICT (external_id, partner) DO UPDATE SET
    amount = EXCLUDED.amount,
    orders_count = EXCLUDED.orders_count,
    received = EXCLUDED.received,
    received_at = EXCLUDED.received_at,
    status = EXCLUDED.status,
    raw = EXCLUDED.raw,
    -- تحديث owner_user_id فقط إذا كان فارغاً (للفواتير القديمة)
    owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
    updated_at = now()
  RETURNING id INTO invoice_id;

  -- Process each order in the invoice
  FOR order_data IN SELECT * FROM jsonb_array_elements(p_orders_data)
  LOOP
    total_orders_count := total_orders_count + 1;
    
    -- Try to find the local order by delivery_partner_order_id first
    SELECT id INTO local_order_id
    FROM public.orders 
    WHERE delivery_partner_order_id = (order_data->>'id')::text
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    -- تصفية حسب المستخدم الحالي أو المديرين
    AND (created_by = v_current_user_id OR is_admin_or_deputy())
    LIMIT 1;
    
    -- If not found, try by tracking_number
    IF local_order_id IS NULL THEN
      SELECT id INTO local_order_id
      FROM public.orders 
      WHERE tracking_number = (order_data->>'id')::text
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      -- تصفية حسب المستخدم الحالي أو المديرين
      AND (created_by = v_current_user_id OR is_admin_or_deputy())
      LIMIT 1;
    END IF;
    
    -- Insert or update the delivery invoice order
    INSERT INTO public.delivery_invoice_orders (
      invoice_id,
      order_id,
      external_order_id,
      raw,
      owner_user_id
    ) VALUES (
      invoice_id,
      local_order_id,
      order_data->>'id',
      order_data,
      v_current_user_id
    )
    ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      raw = EXCLUDED.raw,
      -- تحديث owner_user_id فقط إذا كان فارغاً (للطلبات القديمة)
      owner_user_id = COALESCE(public.delivery_invoice_orders.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();
    
    IF local_order_id IS NOT NULL THEN
      linked_orders_count := linked_orders_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', invoice_id,
    'total_orders', total_orders_count,
    'linked_orders', linked_orders_count,
    'invoice_received', invoice_received
  );
END;
$function$;