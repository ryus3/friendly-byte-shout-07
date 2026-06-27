CREATE OR REPLACE FUNCTION public.set_off_channel_invoice_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT dio.invoice_id
      INTO NEW.invoice_id
    FROM public.delivery_invoice_orders dio
    WHERE dio.order_id = NEW.order_id
      AND dio.invoice_id IS NOT NULL
    ORDER BY dio.updated_at DESC NULLS LAST, dio.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_off_channel_invoice_id ON public.off_channel_collections;
CREATE TRIGGER trg_set_off_channel_invoice_id
  BEFORE INSERT OR UPDATE OF order_id, invoice_id
  ON public.off_channel_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_off_channel_invoice_id();

UPDATE public.off_channel_collections occ
SET invoice_id = dio.invoice_id,
    updated_at = now()
FROM public.delivery_invoice_orders dio
WHERE occ.order_id = dio.order_id
  AND occ.invoice_id IS NULL
  AND dio.invoice_id IS NOT NULL;