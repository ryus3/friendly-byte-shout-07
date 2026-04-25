-- normalized_username is a generated column, no backfill needed.

-- 1) Strong uniqueness: one row per (user, partner, normalized account)
DROP INDEX IF EXISTS public.delivery_partner_tokens_user_partner_norm_uniq;
CREATE UNIQUE INDEX delivery_partner_tokens_user_partner_norm_uniq
  ON public.delivery_partner_tokens (user_id, partner_name, normalized_username)
  WHERE normalized_username IS NOT NULL;

-- 2) At most one default account per (user, partner)
DROP INDEX IF EXISTS public.delivery_partner_tokens_one_default_per_partner;
CREATE UNIQUE INDEX delivery_partner_tokens_one_default_per_partner
  ON public.delivery_partner_tokens (user_id, partner_name)
  WHERE is_default = true;