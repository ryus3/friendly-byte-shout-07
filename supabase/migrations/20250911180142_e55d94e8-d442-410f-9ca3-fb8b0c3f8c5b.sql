-- تنظيف الحسابات المكررة في delivery_partner_tokens
WITH duplicate_accounts AS (
  SELECT 
    user_id,
    partner_name,
    normalized_username,
    MIN(id) as keep_id,
    COUNT(*) as count
  FROM public.delivery_partner_tokens
  WHERE normalized_username IS NOT NULL
  GROUP BY user_id, partner_name, normalized_username
  HAVING COUNT(*) > 1
),
accounts_to_delete AS (
  SELECT dpt.id
  FROM public.delivery_partner_tokens dpt
  JOIN duplicate_accounts da ON (
    dpt.user_id = da.user_id 
    AND dpt.partner_name = da.partner_name 
    AND dpt.normalized_username = da.normalized_username
  )
  WHERE dpt.id != da.keep_id
)
DELETE FROM public.delivery_partner_tokens
WHERE id IN (SELECT id FROM accounts_to_delete);

-- تحديث القيم الفارغة للـ normalized_username
UPDATE public.delivery_partner_tokens 
SET account_username = TRIM(account_username)
WHERE account_username != TRIM(account_username);