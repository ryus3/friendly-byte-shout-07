UPDATE delivery_invoices
SET issued_at = (raw->>'updated_at')::timestamptz
WHERE partner = 'alwaseet'
  AND raw ? 'updated_at'
  AND raw->>'updated_at' IS NOT NULL
  AND (raw->>'updated_at')::timestamptz <> issued_at;