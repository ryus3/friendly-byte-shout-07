-- 1) Auto-link trigger on delivery_invoice_orders insert/update
CREATE OR REPLACE FUNCTION public.auto_link_dio_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner text;
  v_account text;
  v_invoice_external text;
  v_ids text[];
  v_order_id uuid;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT di.partner, di.account_username, di.external_id
    INTO v_partner, v_account, v_invoice_external
  FROM public.delivery_invoices di
  WHERE di.id = NEW.invoice_id;

  v_ids := ARRAY_REMOVE(ARRAY[
    NULLIF(trim(NEW.external_order_id), ''),
    NULLIF(trim(NEW.raw->>'id'), ''),
    NULLIF(trim(NEW.raw->>'qr_id'), ''),
    NULLIF(trim(NEW.raw->>'tracking_number'), ''),
    NULLIF(trim(NEW.raw->>'delivery_partner_order_id'), '')
  ], NULL);

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.id INTO v_order_id
  FROM public.orders o
  WHERE COALESCE(o.delivery_partner, v_partner) = v_partner
    AND (v_account IS NULL OR o.delivery_account_used IS NULL
         OR lower(trim(o.delivery_account_used)) = lower(trim(v_account)))
    AND (o.tracking_number = ANY(v_ids)
         OR o.delivery_partner_order_id = ANY(v_ids)
         OR o.qr_id = ANY(v_ids))
    AND o.status NOT IN ('returned','returned_in_stock','rejected','cancelled')
    AND COALESCE(o.delivery_status,'') NOT IN ('17','12','13','14')
    AND NOT EXISTS (
      SELECT 1 FROM public.delivery_invoice_orders od
      WHERE od.order_id = o.id AND od.id <> NEW.id
    )
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    NEW.order_id := v_order_id;
    UPDATE public.orders
       SET delivery_partner_invoice_id = COALESCE(delivery_partner_invoice_id, v_invoice_external),
           updated_at = now()
     WHERE id = v_order_id
       AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id = '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_dio ON public.delivery_invoice_orders;
CREATE TRIGGER trg_auto_link_dio
BEFORE INSERT OR UPDATE OF external_order_id, raw ON public.delivery_invoice_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_dio_on_change();

-- 2) Reset incomplete invoices so next sync re-fetches them
UPDATE public.delivery_invoices di
SET orders_last_synced_at = NULL
WHERE di.orders_last_synced_at IS NOT NULL
  AND COALESCE(di.orders_count, 0) > (
    SELECT count(*) FROM public.delivery_invoice_orders dio WHERE dio.invoice_id = di.id
  );

-- 3) Force re-link of existing rows
SELECT * FROM public.link_invoice_orders_to_orders();