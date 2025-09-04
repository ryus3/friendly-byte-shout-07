-- Fix the trigger conflict by making the loyalty trigger conditional
-- to avoid conflicts with the invoice sync process

DROP TRIGGER IF EXISTS add_loyalty_points_on_order_completion_trigger ON orders;

-- Recreate the trigger to only fire when the status change is NOT part of an invoice sync
-- We'll use the receipt_received field to detect invoice sync operations
CREATE OR REPLACE FUNCTION add_loyalty_points_on_order_completion_safe()
RETURNS TRIGGER AS $$
DECLARE
  existing_loyalty_id UUID;
  points_to_add INTEGER := 50;
  customer_tier_multiplier NUMERIC := 1.0;
BEGIN
  -- Only proceed if this is a genuine completion, not part of invoice sync
  -- If receipt_received changed in the same transaction, skip loyalty update
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
    -- This is likely an invoice sync operation, skip loyalty processing
    RETURN NEW;
  END IF;

  -- Check if customer has existing loyalty record
  SELECT cl.id INTO existing_loyalty_id
  FROM public.customer_loyalty cl
  WHERE cl.customer_id = NEW.customer_id;

  IF existing_loyalty_id IS NOT NULL THEN
    -- Update existing loyalty record
    UPDATE public.customer_loyalty 
    SET total_points = total_points + points_to_add,
        total_spent = total_spent + NEW.final_amount,
        total_orders = total_orders + 1,
        updated_at = now()
    WHERE customer_id = NEW.customer_id;
  ELSE
    -- Create new loyalty record
    INSERT INTO public.customer_loyalty (
      customer_id, 
      total_points, 
      total_spent, 
      total_orders
    ) VALUES (
      NEW.customer_id, 
      points_to_add, 
      NEW.final_amount, 
      1
    );
  END IF;

  -- Add points history record
  INSERT INTO public.loyalty_points_history (
    customer_id,
    order_id,
    points_earned,
    transaction_type,
    description
  ) VALUES (
    NEW.customer_id,
    NEW.id,
    points_to_add,
    'order_completion',
    'نقاط إكمال الطلب'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger with the new safe function
CREATE TRIGGER add_loyalty_points_on_order_completion_trigger
  AFTER UPDATE OF status
  ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION add_loyalty_points_on_order_completion_safe();