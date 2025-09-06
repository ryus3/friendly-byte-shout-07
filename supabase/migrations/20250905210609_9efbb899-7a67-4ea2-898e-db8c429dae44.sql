-- دالة لتنظيف فواتير التوصيل والاحتفاظ بآخر 10 فواتير لكل موظف
CREATE OR REPLACE FUNCTION public.cleanup_delivery_invoices_keep_latest(p_keep_count integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_deleted integer := 0;
  v_employee_record record;
BEGIN
  -- تنظيف الفواتير لكل موظف على حدة
  FOR v_employee_record IN 
    SELECT DISTINCT owner_user_id 
    FROM public.delivery_invoices 
    WHERE owner_user_id IS NOT NULL
      AND partner = 'alwaseet'
  LOOP
    -- حذف الفواتير القديمة للموظف مع الاحتفاظ بآخر 10
    WITH ranked_invoices AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY owner_user_id 
               ORDER BY COALESCE(issued_at, created_at) DESC, created_at DESC
             ) as rn
      FROM public.delivery_invoices
      WHERE owner_user_id = v_employee_record.owner_user_id
        AND partner = 'alwaseet'
    ),
    deleted AS (
      DELETE FROM public.delivery_invoices 
      WHERE id IN (
        SELECT id FROM ranked_invoices WHERE rn > p_keep_count
      )
      RETURNING id
    )
    SELECT COUNT(*) INTO v_total_deleted FROM deleted;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_deleted', v_total_deleted,
    'kept_per_employee', p_keep_count,
    'cleanup_timestamp', now()
  );
END;
$function$;

-- دالة محدثة لجلب الفواتير مع تنظيف تلقائي
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list_with_cleanup(p_invoices jsonb, p_employee_id uuid)
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
BEGIN
  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- إدراج/تحديث الفواتير
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

  -- تنظيف تلقائي للاحتفاظ بآخر 10 فواتير لهذا الموظف
  PERFORM public.prune_delivery_invoices_for_user(p_employee_id, 10);

  RETURN jsonb_build_object('success', true, 'processed', v_upserts);
END;
$function$;