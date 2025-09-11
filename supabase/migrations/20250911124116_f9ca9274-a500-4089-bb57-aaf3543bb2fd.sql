-- Drop the old unique constraint that prevents multiple accounts per user/partner
ALTER TABLE public.delivery_partner_tokens DROP CONSTRAINT IF EXISTS unique_user_partner;

-- Add new unique constraint to allow multiple accounts but prevent duplicate usernames per user/partner
ALTER TABLE public.delivery_partner_tokens 
ADD CONSTRAINT unique_user_partner_account UNIQUE (user_id, partner_name, account_username);

-- Create unique partial index to ensure only one default account per user/partner
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_account 
ON public.delivery_partner_tokens (user_id, partner_name) 
WHERE is_default = true;

-- Update existing accounts to set the most recently used as default if no default exists
UPDATE public.delivery_partner_tokens 
SET is_default = true 
WHERE id IN (
  SELECT DISTINCT ON (user_id, partner_name) id
  FROM public.delivery_partner_tokens 
  WHERE NOT EXISTS (
    SELECT 1 FROM public.delivery_partner_tokens dpt2 
    WHERE dpt2.user_id = delivery_partner_tokens.user_id 
    AND dpt2.partner_name = delivery_partner_tokens.partner_name 
    AND dpt2.is_default = true
  )
  ORDER BY user_id, partner_name, last_used_at DESC NULLS LAST, created_at DESC
);