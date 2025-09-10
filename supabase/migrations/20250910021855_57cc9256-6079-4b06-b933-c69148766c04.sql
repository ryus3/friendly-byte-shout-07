-- Fix profit calculation issues for orders

-- Step 1: Correct inconsistent final_amount and sales_amount values
UPDATE public.orders 
SET 
  final_amount = CASE 
    WHEN delivery_partner = 'alwaseet' OR LOWER(delivery_partner) = 'alwaseet' THEN
      GREATEST(0, COALESCE(total_amount, 0) - COALESCE(discount, 0) + COALESCE(delivery_fee, 0))
    ELSE 
      GREATEST(0, COALESCE(total_amount, 0) - COALESCE(discount, 0) + COALESCE(delivery_fee, 0))
  END,
  sales_amount = CASE 
    WHEN sales_amount IS NULL OR sales_amount = 0 THEN
      GREATEST(0, COALESCE(total_amount, 0) - COALESCE(discount, 0))
    ELSE sales_amount
  END,
  updated_at = now()
WHERE 
  -- Only update records where final_amount is inconsistent
  final_amount != (COALESCE(total_amount, 0) - COALESCE(discount, 0) + COALESCE(delivery_fee, 0))
  OR sales_amount IS NULL 
  OR sales_amount = 0;

-- Step 2: Create trigger function to automatically calculate correct amounts
CREATE OR REPLACE FUNCTION public.normalize_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate sales_amount (revenue without delivery fee)
  NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount, 0));
  
  -- Calculate final_amount (total customer payment including delivery)
  NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount, 0) + COALESCE(NEW.delivery_fee, 0));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Create trigger to ensure data consistency
DROP TRIGGER IF EXISTS normalize_order_amounts_trigger ON public.orders;
CREATE TRIGGER normalize_order_amounts_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_order_amounts();

-- Step 4: Log the correction for order 101264291 specifically
DO $$
DECLARE
  v_order_record RECORD;
BEGIN
  SELECT order_number, total_amount, discount, delivery_fee, final_amount, sales_amount
  INTO v_order_record
  FROM public.orders 
  WHERE order_number = '101264291';
  
  IF FOUND THEN
    RAISE NOTICE 'Order 101264291 corrected: total=%, discount=%, delivery=%, final_amount=%, sales_amount=%', 
      v_order_record.total_amount, v_order_record.discount, v_order_record.delivery_fee, 
      v_order_record.final_amount, v_order_record.sales_amount;
  END IF;
END $$;