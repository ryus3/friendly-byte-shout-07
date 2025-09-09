-- SECURITY FIX: Remove security definer views to prevent privilege escalation
-- Convert security definer views to security invoker for proper RLS enforcement

-- Fix the remaining security definer view
DROP VIEW IF EXISTS public.orders_secure_view;
CREATE OR REPLACE VIEW public.orders_secure_view
WITH (security_invoker = true) AS
SELECT 
  id,
  order_number,
  tracking_number,
  -- Anonymize customer data for non-admin users
  CASE 
    WHEN can_view_all_orders() THEN customer_name
    ELSE CONCAT(LEFT(customer_name, 1), '***')
  END as customer_name,
  CASE 
    WHEN can_view_all_orders() THEN customer_phone
    ELSE CONCAT('***', RIGHT(customer_phone, 4))
  END as customer_phone,
  CASE 
    WHEN can_view_all_orders() THEN customer_address
    ELSE '*** محجوب للخصوصية ***'
  END as customer_address,
  customer_city,
  customer_province,
  delivery_partner,
  delivery_status,
  delivery_partner_order_id,
  delivery_partner_invoice_id,
  status,
  receipt_received,
  receipt_received_at,
  receipt_received_by,
  isarchived,
  final_amount,
  discount,
  delivery_fee,
  notes,
  created_by,
  created_at,
  updated_at,
  qr_id
FROM public.orders
WHERE can_view_all_orders() OR created_by = auth.uid();