
-- Add owner_user_id to products table for financial ownership tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON products(owner_user_id);
