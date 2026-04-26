-- Targeted recovery for the currently affected AlWaseet account after false token-expiry invalidation
UPDATE public.delivery_partner_tokens
SET
  is_active = true,
  auto_renew_enabled = true,
  updated_at = now()
WHERE partner_name = 'alwaseet'
  AND lower(coalesce(account_username, normalized_username, '')) = 'alshmry94'
  AND token IS NOT NULL
  AND length(trim(token)) > 0
  AND expires_at IS NOT NULL
  AND expires_at > now();