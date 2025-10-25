-- Security Fix: Add comprehensive RLS policies for critical tables
-- Issue: Tables with single or incomplete RLS policies

-- ============================================
-- 1. Fix order_items table (currently 1 policy)
-- ============================================

-- Drop existing incomplete policies
DROP POLICY IF EXISTS "Order items manageable by authenticated users" ON order_items;

-- Add comprehensive policies for order_items
CREATE POLICY "order_items_select"
ON order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.created_by = auth.uid() OR is_admin_or_deputy())
  )
);

CREATE POLICY "order_items_insert"
ON order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND orders.created_by = auth.uid()
  )
);

CREATE POLICY "order_items_update"
ON order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.created_by = auth.uid() OR is_admin_or_deputy())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.created_by = auth.uid() OR is_admin_or_deputy())
  )
);

CREATE POLICY "order_items_delete"
ON order_items FOR DELETE
USING (is_admin_or_deputy());

-- ============================================
-- 2. Fix colors table (currently public)
-- ============================================

-- Drop public access policy
DROP POLICY IF EXISTS "Anyone can view colors" ON colors;

-- Require authentication for viewing colors
CREATE POLICY "colors_select"
ON colors FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================
-- 3. Add Telegram webhook signature verification
-- ============================================

-- Create function to validate Telegram webhook secret token
CREATE OR REPLACE FUNCTION validate_telegram_webhook_token(
  secret_token TEXT,
  expected_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate that secret token matches expected token
  RETURN secret_token = expected_token;
END;
$$;

COMMENT ON FUNCTION validate_telegram_webhook_token IS 
  'Validates Telegram webhook secret token for security. Used by Edge Functions to verify incoming webhook requests.';

-- ============================================
-- 4. Add missing RLS policies for cash_movements
-- ============================================

DROP POLICY IF EXISTS "Only financial admins can manage cash movements" ON cash_movements;

-- Financial admins can view all
CREATE POLICY "cash_movements_select"
ON cash_movements FOR SELECT
USING (is_financial_admin());

-- Financial admins can create
CREATE POLICY "cash_movements_insert"
ON cash_movements FOR INSERT
WITH CHECK (
  is_financial_admin() AND
  created_by = auth.uid()
);

-- Financial admins can update
CREATE POLICY "cash_movements_update"
ON cash_movements FOR UPDATE
USING (is_financial_admin())
WITH CHECK (is_financial_admin());

-- Only super admins can delete
CREATE POLICY "cash_movements_delete"
ON cash_movements FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'super_admin'
      AND ur.is_active = true
  )
);