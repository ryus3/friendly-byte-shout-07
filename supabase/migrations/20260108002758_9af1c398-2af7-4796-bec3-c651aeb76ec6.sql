-- حذف الدالة القديمة أولاً ثم إنشاء الجديدة
DROP FUNCTION IF EXISTS public.upsert_alwaseet_invoice_list(jsonb);

-- إعادة إنشاء الدالة مع اشتقاق received و status_normalized من نص status
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_upserted integer := 0;
  v_invoice jsonb;
  v_external_id text;
  v_status text;
  v_status_normalized text;
  v_received boolean;
BEGIN
  FOR v_invoice IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_external_id := COALESCE(v_invoice->>'id', v_invoice->>'external_id');
    v_status := v_invoice->>'status';
    
    -- ✅ اشتقاق status_normalized و received من نص status (نفس منطق Edge Function)
    IF v_status ILIKE '%التاجر%' THEN
      v_status_normalized := 'received';
      v_received := true;
    ELSIF v_status ILIKE '%مستلم%' AND v_status NOT ILIKE '%المندوب%' THEN
      v_status_normalized := 'received';
      v_received := true;
    ELSIF v_status ILIKE '%استلام%' AND v_status NOT ILIKE '%المندوب%' THEN
      v_status_normalized := 'received';
      v_received := true;
    ELSIF v_status ILIKE '%ملغ%' OR v_status ILIKE '%cancel%' THEN
      v_status_normalized := 'cancelled';
      v_received := false;
    ELSIF v_status ILIKE '%مرسل%' OR v_status ILIKE '%sent%' THEN
      v_status_normalized := 'sent';
      v_received := false;
    ELSE
      v_status_normalized := 'pending';
      v_received := false;
    END IF;
    
    INSERT INTO delivery_invoices (
      external_id,
      partner,
      amount,
      orders_count,
      status,
      status_normalized,
      received,
      received_flag,
      issued_at,
      raw,
      owner_user_id,
      account_username,
      merchant_id,
      partner_name_ar,
      last_synced_at
    ) VALUES (
      v_external_id,
      COALESCE(v_invoice->>'partner', 'alwaseet'),
      COALESCE((v_invoice->>'merchant_price')::numeric, (v_invoice->>'amount')::numeric, 0),
      COALESCE((v_invoice->>'delivered_orders_count')::integer, (v_invoice->>'orders_count')::integer, 0),
      v_status,
      v_status_normalized,
      v_received,
      v_received,
      COALESCE((v_invoice->>'updated_at')::timestamptz, (v_invoice->>'issued_at')::timestamptz, now()),
      v_invoice,
      v_invoice->>'owner_user_id',
      v_invoice->>'account_username',
      v_invoice->>'merchant_id',
      v_invoice->>'partner_name_ar',
      now()
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = COALESCE((EXCLUDED.raw->>'merchant_price')::numeric, (EXCLUDED.raw->>'amount')::numeric, delivery_invoices.amount),
      orders_count = COALESCE((EXCLUDED.raw->>'delivered_orders_count')::integer, (EXCLUDED.raw->>'orders_count')::integer, delivery_invoices.orders_count),
      status = COALESCE(EXCLUDED.status, delivery_invoices.status),
      -- ✅ تحديث status_normalized و received بناءً على نص status الجديد
      status_normalized = CASE 
        WHEN EXCLUDED.status ILIKE '%التاجر%' THEN 'received'
        WHEN EXCLUDED.status ILIKE '%مستلم%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN 'received'
        WHEN EXCLUDED.status ILIKE '%استلام%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN 'received'
        WHEN EXCLUDED.status ILIKE '%ملغ%' OR EXCLUDED.status ILIKE '%cancel%' THEN 'cancelled'
        WHEN EXCLUDED.status ILIKE '%مرسل%' OR EXCLUDED.status ILIKE '%sent%' THEN 'sent'
        ELSE COALESCE(delivery_invoices.status_normalized, 'pending')
      END,
      received = CASE 
        WHEN EXCLUDED.status ILIKE '%التاجر%' THEN true
        WHEN EXCLUDED.status ILIKE '%مستلم%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN true
        WHEN EXCLUDED.status ILIKE '%استلام%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN true
        ELSE COALESCE(delivery_invoices.received, false)
      END,
      received_flag = CASE 
        WHEN EXCLUDED.status ILIKE '%التاجر%' THEN true
        WHEN EXCLUDED.status ILIKE '%مستلم%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN true
        WHEN EXCLUDED.status ILIKE '%استلام%' AND EXCLUDED.status NOT ILIKE '%المندوب%' THEN true
        ELSE COALESCE(delivery_invoices.received_flag, false)
      END,
      issued_at = COALESCE(EXCLUDED.issued_at, delivery_invoices.issued_at),
      raw = EXCLUDED.raw,
      account_username = COALESCE(EXCLUDED.account_username, delivery_invoices.account_username),
      merchant_id = COALESCE(EXCLUDED.merchant_id, delivery_invoices.merchant_id),
      partner_name_ar = COALESCE(EXCLUDED.partner_name_ar, delivery_invoices.partner_name_ar),
      last_synced_at = now(),
      updated_at = now();
    
    v_upserted := v_upserted + 1;
  END LOOP;
  
  v_result := jsonb_build_object(
    'success', true,
    'upserted_count', v_upserted
  );
  
  RETURN v_result;
END;
$$;