-- Backfill البيانات القديمة من raw field
UPDATE delivery_invoices
SET 
  account_username = raw->>'account_username',
  partner_name_ar = raw->>'partner_name_ar',
  updated_at = NOW()
WHERE (account_username IS NULL OR partner_name_ar IS NULL)
  AND raw IS NOT NULL
  AND (raw->>'account_username' IS NOT NULL OR raw->>'partner_name_ar' IS NOT NULL);