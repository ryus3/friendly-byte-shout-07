-- Add unique constraint to delivery_partner_tokens table to prevent conflicts
ALTER TABLE delivery_partner_tokens 
ADD CONSTRAINT unique_user_partner UNIQUE (user_id, partner_name);

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Users can manage their delivery partner tokens" ON delivery_partner_tokens;

CREATE POLICY "Users can manage their delivery partner tokens" 
ON delivery_partner_tokens 
FOR ALL 
USING ((user_id = auth.uid()) OR is_admin_or_deputy())
WITH CHECK ((user_id = auth.uid()) OR is_admin_or_deputy());