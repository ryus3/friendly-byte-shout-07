-- 1) BEFORE UPDATE trigger on orders: stamp receipt_received and auto-complete manager orders
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- If the order belongs to the manager/system owner, mark as completed
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      -- Only move forward from delivered to completed
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_receipt_received_order ON public.orders;
CREATE TRIGGER trg_handle_receipt_received_order
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_receipt_received_order();

-- 2) AFTER UPDATE trigger on profits: when employee dues are settled, set order to completed (if invoice received)
CREATE OR REPLACE FUNCTION public.complete_order_when_profit_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'settled' AND COALESCE(OLD.status, '') <> 'settled' THEN
    UPDATE public.orders o
    SET status = 'completed', updated_at = now()
    WHERE o.id = NEW.order_id
      AND o.receipt_received = true
      AND o.status <> 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_order_when_profit_settled ON public.profits;
CREATE TRIGGER trg_complete_order_when_profit_settled
AFTER UPDATE ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.complete_order_when_profit_settled();

-- 3) Retroactive fixes
-- 3.a) Manager orders already invoice-received -> complete them
UPDATE public.orders
SET status = 'completed', updated_at = now()
WHERE receipt_received = true
  AND status = 'delivered'
  AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- 3.b) Employee orders with settled profits and invoice received -> complete them
UPDATE public.orders o
SET status = 'completed', updated_at = now()
FROM public.profits p
WHERE p.order_id = o.id
  AND p.status = 'settled'
  AND o.receipt_received = true
  AND o.status <> 'completed';

-- 3.c) Ensure specific order 98713588 is completed if it meets the rules
UPDATE public.orders o
SET status = 'completed', updated_at = now()
WHERE o.order_number = '98713588'
  AND o.receipt_received = true
  AND (
    o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    OR EXISTS (
      SELECT 1 FROM public.profits p WHERE p.order_id = o.id AND p.status = 'settled'
    )
  )
  AND o.status <> 'completed';