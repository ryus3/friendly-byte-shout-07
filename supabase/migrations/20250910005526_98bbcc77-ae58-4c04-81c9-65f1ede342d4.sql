-- Fix AlWaseet delivery status standardization and stock management

-- 1. Create trigger function to standardize AlWaseet delivery_status
CREATE OR REPLACE FUNCTION public.standardize_alwaseet_delivery_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process AlWaseet orders
  IF LOWER(COALESCE(NEW.delivery_partner, '')) = 'alwaseet' THEN
    -- Standardize delivery_status to numerical codes
    IF NEW.delivery_status = 'تم التسليم للزبون' OR NEW.delivery_status = 'delivered' THEN
      NEW.delivery_status := '4';
    ELSIF NEW.delivery_status = 'تم الارجاع الى التاجر' OR NEW.delivery_status = 'returned_to_merchant' THEN
      NEW.delivery_status := '17';
    ELSIF NEW.delivery_status = 'فعال' OR NEW.delivery_status = 'active' THEN
      NEW.delivery_status := '1';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create trigger function to automatically manage stock reservations
CREATE OR REPLACE FUNCTION public.auto_manage_stock_reservations()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status or delivery_status actually changes
  IF (TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR 
    OLD.delivery_status IS DISTINCT FROM NEW.delivery_status
  )) OR TG_OP = 'INSERT' THEN
    
    -- Call the existing stock management function
    PERFORM public.update_order_reservation_status(
      NEW.id,
      NEW.status,
      NEW.delivery_status,
      NEW.delivery_partner
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create the triggers
DROP TRIGGER IF EXISTS standardize_alwaseet_status_trigger ON public.orders;
CREATE TRIGGER standardize_alwaseet_status_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.standardize_alwaseet_delivery_status();

DROP TRIGGER IF EXISTS auto_stock_management_trigger ON public.orders;
CREATE TRIGGER auto_stock_management_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_manage_stock_reservations();

-- 4. Fix historical AlWaseet orders with text-based delivery_status
UPDATE public.orders 
SET delivery_status = '4', updated_at = now()
WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
  AND delivery_status = 'تم التسليم للزبون';

UPDATE public.orders 
SET delivery_status = '17', updated_at = now()
WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
  AND delivery_status = 'تم الارجاع الى التاجر';

UPDATE public.orders 
SET delivery_status = '1', updated_at = now()
WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
  AND delivery_status = 'فعال';

-- 5. Re-trigger stock management for all recent AlWaseet orders to ensure correct stock status
DO $$
DECLARE
  order_record RECORD;
BEGIN
  FOR order_record IN 
    SELECT id, status, delivery_status, delivery_partner
    FROM public.orders 
    WHERE LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      AND created_at >= now() - interval '30 days'
  LOOP
    PERFORM public.update_order_reservation_status(
      order_record.id,
      order_record.status,
      order_record.delivery_status,
      order_record.delivery_partner
    );
  END LOOP;
END $$;