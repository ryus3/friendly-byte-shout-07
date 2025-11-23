-- Fix SECURITY DEFINER functions by adding search_path protection
-- This prevents search_path manipulation attacks

-- 1. Fix process_returned_order_inventory
CREATE OR REPLACE FUNCTION public.process_returned_order_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update inventory for returned items
  UPDATE inventory i
  SET 
    quantity = quantity + oi.quantity,
    reserved_quantity = GREATEST(0, reserved_quantity - oi.quantity),
    updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = NEW.id
    AND oi.variant_id = i.variant_id
    AND NEW.status = 'returned_in_stock'
    AND OLD.status != 'returned_in_stock';
  
  RETURN NEW;
END;
$$;

-- 2. Fix update_order_status_changed_at
CREATE OR REPLACE FUNCTION public.update_order_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Fix auto_generate_telegram_code
CREATE OR REPLACE FUNCTION public.auto_generate_telegram_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Generate unique 6-character code
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM employee_telegram_codes 
      WHERE telegram_code = new_code AND is_active = true
    );
  END LOOP;
  
  NEW.telegram_code := new_code;
  RETURN NEW;
END;
$$;

-- 4. Drop and recreate extract_product_items_from_text with proper signature
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

CREATE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS TABLE(product_name text, quantity integer, unit_price numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    regexp_replace(line, '^\d+[\.\)]\s*', '') as product_name,
    1 as quantity,
    0::numeric as unit_price
  FROM unnest(string_to_array(input_text, E'\n')) as line
  WHERE line ~ '^\d+[\.\)]';
END;
$$;

-- Comment: All SECURITY DEFINER functions now have SET search_path = public
-- to prevent search_path manipulation attacks