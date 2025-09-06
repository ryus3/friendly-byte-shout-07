-- Create comprehensive trigger to auto-fix delivery_partner_order_id and qr_id for AlWaseet orders
CREATE OR REPLACE FUNCTION public.auto_fix_alwaseet_order_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only process AlWaseet orders
  IF LOWER(COALESCE(NEW.delivery_partner, '')) = 'alwaseet' THEN
    
    -- If delivery_partner_order_id is null but tracking_number exists, use it
    IF NEW.delivery_partner_order_id IS NULL AND NEW.tracking_number IS NOT NULL THEN
      NEW.delivery_partner_order_id = NEW.tracking_number;
      RAISE NOTICE 'Auto-fixed delivery_partner_order_id from tracking_number for order %', NEW.tracking_number;
    END IF;
    
    -- If qr_id is null but tracking_number exists, use it
    IF NEW.qr_id IS NULL AND NEW.tracking_number IS NOT NULL THEN
      NEW.qr_id = NEW.tracking_number;
      RAISE NOTICE 'Auto-fixed qr_id from tracking_number for order %', NEW.tracking_number;
    END IF;
    
    -- If both delivery_partner_order_id and qr_id are null but one exists, sync them
    IF NEW.delivery_partner_order_id IS NOT NULL AND NEW.qr_id IS NULL THEN
      NEW.qr_id = NEW.delivery_partner_order_id;
    ELSIF NEW.qr_id IS NOT NULL AND NEW.delivery_partner_order_id IS NULL THEN
      NEW.delivery_partner_order_id = NEW.qr_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS fix_alwaseet_fields_insert ON public.orders;
CREATE TRIGGER fix_alwaseet_fields_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fix_alwaseet_order_fields();

-- Create trigger for UPDATE operations  
DROP TRIGGER IF EXISTS fix_alwaseet_fields_update ON public.orders;
CREATE TRIGGER fix_alwaseet_fields_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fix_alwaseet_order_fields();

-- Fix all existing AlWaseet orders with missing delivery_partner_order_id
UPDATE public.orders 
SET 
  delivery_partner_order_id = CASE 
    WHEN delivery_partner_order_id IS NULL THEN tracking_number
    ELSE delivery_partner_order_id
  END,
  qr_id = CASE 
    WHEN qr_id IS NULL THEN tracking_number
    ELSE qr_id
  END,
  updated_at = now()
WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet' 
  AND (delivery_partner_order_id IS NULL OR qr_id IS NULL)
  AND tracking_number IS NOT NULL;