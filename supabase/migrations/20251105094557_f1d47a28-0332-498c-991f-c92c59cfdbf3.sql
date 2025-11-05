-- ===================================================
-- المرحلة 3 و 4: إضافة أعمدة الفواتير وتحديث الدالة
-- ===================================================

-- إضافة الأعمدة الجديدة لجدول الفواتير
ALTER TABLE delivery_invoices 
ADD COLUMN IF NOT EXISTS account_username TEXT,
ADD COLUMN IF NOT EXISTS partner_name_ar TEXT;

-- إنشاء فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_account 
ON delivery_invoices(account_username);

-- تحديث الفواتير القديمة بأثر رجعي
UPDATE delivery_invoices di
SET 
  account_username = dpt.account_username,
  partner_name_ar = CASE 
    WHEN dpt.partner_name = 'modon' THEN 'مدن'
    WHEN dpt.partner_name = 'alwaseet' THEN 'الوسيط'
    ELSE dpt.partner_name
  END
FROM delivery_partner_tokens dpt
WHERE di.merchant_id = dpt.merchant_id
  AND di.owner_user_id = dpt.user_id
  AND di.account_username IS NULL;

-- ===================================================
-- تحديث دالة upsert_alwaseet_invoice_list
-- ===================================================

CREATE OR REPLACE FUNCTION upsert_alwaseet_invoice_list(p_invoices JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invoice_record JSONB;
BEGIN
  FOR invoice_record IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    INSERT INTO delivery_invoices (
      external_id,
      partner,
      status,
      received,
      amount,
      orders_count,
      issued_at,
      received_at,
      raw,
      merchant_id,
      owner_user_id,
      account_username,
      partner_name_ar,
      created_at,
      updated_at
    ) VALUES (
      (invoice_record->>'id')::TEXT,
      (invoice_record->>'partner')::TEXT,
      (invoice_record->>'status')::TEXT,
      COALESCE((invoice_record->>'received')::BOOLEAN, false),
      COALESCE((invoice_record->>'merchant_price')::NUMERIC, 0),
      COALESCE((invoice_record->>'delivered_orders_count')::INTEGER, 0),
      COALESCE((invoice_record->>'updated_at')::TIMESTAMPTZ, NOW()),
      (invoice_record->>'received_at')::TIMESTAMPTZ,
      invoice_record,
      (invoice_record->>'merchant_id')::TEXT,
      (invoice_record->>'owner_user_id')::UUID,
      (invoice_record->>'account_username')::TEXT,
      (invoice_record->>'partner_name_ar')::TEXT,
      COALESCE((invoice_record->>'created_at')::TIMESTAMPTZ, NOW()),
      NOW()
    )
    ON CONFLICT (external_id, partner)
    DO UPDATE SET
      status = EXCLUDED.status,
      received = EXCLUDED.received,
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      issued_at = EXCLUDED.issued_at,
      received_at = EXCLUDED.received_at,
      raw = EXCLUDED.raw,
      merchant_id = EXCLUDED.merchant_id,
      owner_user_id = EXCLUDED.owner_user_id,
      account_username = EXCLUDED.account_username,
      partner_name_ar = EXCLUDED.partner_name_ar,
      updated_at = NOW();
  END LOOP;
END;
$$;