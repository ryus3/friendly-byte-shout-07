-- Restore stable delivery partner token behavior without deleting any accounts

-- Remove older duplicate uniqueness rules that conflict with multi-account/shared-account behavior
ALTER TABLE public.delivery_partner_tokens
  DROP CONSTRAINT IF EXISTS delivery_partner_tokens_multi_account_unique;

ALTER TABLE public.delivery_partner_tokens
  DROP CONSTRAINT IF EXISTS unique_user_partner_account;

DROP INDEX IF EXISTS public.idx_delivery_partner_tokens_unique_user_partner_username;
DROP INDEX IF EXISTS public.delivery_partner_tokens_multi_account_unique;
DROP INDEX IF EXISTS public.unique_user_partner_account;

-- Keep at most one default per user/partner, but remove duplicate equivalent indexes if present
DROP INDEX IF EXISTS public.idx_unique_default_account;

-- Recover non-expired token rows that were incorrectly deactivated by proxy token-expiry handling
UPDATE public.delivery_partner_tokens
SET
  is_active = true,
  auto_renew_enabled = true,
  updated_at = now()
WHERE token IS NOT NULL
  AND length(trim(token)) > 0
  AND expires_at IS NOT NULL
  AND expires_at > now();

-- Ensure new/valid rows prefer automatic renewal unless explicitly changed later
ALTER TABLE public.delivery_partner_tokens
  ALTER COLUMN auto_renew_enabled SET DEFAULT true;