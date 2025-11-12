-- تنظيف Database من 'local' كشريك توصيل افتراضي
UPDATE profiles 
SET selected_delivery_partner = 'alwaseet',
    updated_at = now()
WHERE selected_delivery_partner = 'local' OR selected_delivery_partner IS NULL;

-- حذف أي tokens لـ 'local' (إن وجدت)
DELETE FROM delivery_partner_tokens
WHERE partner_name = 'local';