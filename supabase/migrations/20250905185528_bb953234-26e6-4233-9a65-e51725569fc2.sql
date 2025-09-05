
-- 1) تحديث دالة الإدراج/التحديث الجماعي للفواتير لضمان تعبئة issued_at دائماً
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb)
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
    -- fallback فوري لضمان عدم ترك issued_at فارغاً
    v_updated_at := COALESCE(NULLIF(v_item->>'updated_at','')::timestamptz, now());

    INSERT INTO public.delivery_invoices (
      external_id, partner, amount, orders_count, status, merchant_id,
      issued_at, last_api_updated_at, raw, owner_user_id
    ) VALUES (
      v_id, 'alwaseet', v_amount, v_count, v_status, v_merchant_id,
      v_updated_at, v_updated_at, v_item, v_current_user_id
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      status = EXCLUDED.status,
      merchant_id = EXCLUDED.merchant_id,
      -- ضمان وجود issued_at دائماً حتى لو كان من نسخة قديمة بلا updated_at
      issued_at = COALESCE(
        EXCLUDED.issued_at,
        public.delivery_invoices.issued_at,
        EXCLUDED.last_api_updated_at,
        public.delivery_invoices.last_api_updated_at,
        public.delivery_invoices.created_at,
        now()
      ),
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, public.delivery_invoices.last_api_updated_at),
      raw = EXCLUDED.raw,
      owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();

    v_upserts := v_upserts + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_upserts);
END;
$function$;

-- 2) معالجة البيانات الحالية: تعبئة issued_at للفواتير التي بدون تاريخ
UPDATE public.delivery_invoices
SET issued_at = COALESCE(last_api_updated_at, created_at, now()),
    updated_at = now()
WHERE partner = 'alwaseet'
  AND issued_at IS NULL;
