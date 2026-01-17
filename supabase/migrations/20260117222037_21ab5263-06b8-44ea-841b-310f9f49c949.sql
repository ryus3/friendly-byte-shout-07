-- Add auto_renew_enabled column to delivery_partner_tokens
ALTER TABLE public.delivery_partner_tokens 
ADD COLUMN IF NOT EXISTS auto_renew_enabled boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.delivery_partner_tokens.auto_renew_enabled IS 'When true, token will be automatically renewed on its last day (within 24 hours of expiry)';