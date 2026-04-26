-- Restore previous safe behavior on delivery_partner_tokens:
-- 1) Drop the strict indexes added recently which constrain multi-account/shared-account flow
DROP INDEX IF EXISTS public.delivery_partner_tokens_user_partner_norm_uniq;
DROP INDEX IF EXISTS public.delivery_partner_tokens_one_default_per_partner;
-- These two are duplicates of legacy indexes/constraints; the legacy ones will remain:
-- delivery_partner_tokens_multi_account_unique  : UNIQUE (user_id, partner_name, account_username)
-- idx_delivery_partner_tokens_unique_user_partner_username : UNIQUE same triple (kept for safety)
-- idx_unique_default_account: UNIQUE (user_id, partner_name) WHERE is_default
-- delivery_partner_tokens_default_unique_idx: same default partial unique (kept)
-- unique_user_partner_account constraint: UNIQUE (user_id, partner_name, account_username) (kept)

-- 2) Auto-renew should be ON by default for new accounts
ALTER TABLE public.delivery_partner_tokens
  ALTER COLUMN auto_renew_enabled SET DEFAULT true;

-- 3) Backfill: enable auto-renew for active accounts that have saved credentials,
--    so the weekly token can be renewed automatically by the cron edge function.
UPDATE public.delivery_partner_tokens
SET auto_renew_enabled = true
WHERE auto_renew_enabled IS DISTINCT FROM true
  AND is_active = true
  AND partner_data ? 'password';
