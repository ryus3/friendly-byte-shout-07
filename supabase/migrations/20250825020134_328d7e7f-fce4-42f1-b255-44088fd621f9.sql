-- Address linter warnings: remove SECURITY DEFINER from trigger function and set search_path explicitly

-- Update updated_at helper with explicit search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate propagation function without SECURITY DEFINER and with explicit search_path
CREATE OR REPLACE FUNCTION public.propagate_invoice_received_to_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = false;
  END IF;
  RETURN NEW;
END;
$$;