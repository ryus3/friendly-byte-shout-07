-- Fix the current order 98713588 immediately
UPDATE public.orders
SET 
  receipt_received = true,
  receipt_received_at = now(),
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
  delivery_partner_invoice_id = '1962564',
  status = 'completed',
  updated_at = now()
WHERE tracking_number = '98713588' 
  AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- Add tables to realtime publication for automatic updates
ALTER TABLE IF EXISTS public.delivery_invoices REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.delivery_invoice_orders REPLICA IDENTITY FULL;