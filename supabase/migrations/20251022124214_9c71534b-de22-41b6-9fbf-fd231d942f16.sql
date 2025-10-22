-- Fix overly permissive SELECT policy on ai_orders table
-- This policy was allowing any authenticated user to see all AI orders,
-- including sensitive customer data (names, phones, addresses, telegram chat IDs)

-- Drop the insecure policy
DROP POLICY IF EXISTS "Authenticated users can view ai orders" ON ai_orders;

-- Create a strict policy: users see only their own orders, admins see all
CREATE POLICY "Employees see own ai_orders"
ON ai_orders FOR SELECT
USING (
  created_by = auth.uid()::text 
  OR processed_by = auth.uid()
  OR is_admin_or_deputy()
);