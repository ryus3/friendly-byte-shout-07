
-- ============================================================
-- PART 1: UNIFIED RESERVED QUANTITY (zero discrepancies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.calc_reserved_for_variant(p_variant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(oi.quantity), 0)::integer
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.variant_id = p_variant_id
    AND COALESCE(o.order_type, 'normal') <> 'return'
    AND o.status IN ('pending','shipped','delivery','returned','partial_delivery','cancelled')
    AND COALESCE(o.delivery_status::text, '') NOT IN ('4','17')
    AND COALESCE(oi.item_status, '') NOT IN ('delivered','returned_in_stock','returned')
    AND COALESCE(oi.item_direction, 'outgoing') <> 'incoming';
$$;

CREATE OR REPLACE FUNCTION public.sync_reserved_for_variant(p_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct integer;
BEGIN
  IF p_variant_id IS NULL THEN RETURN; END IF;
  v_correct := public.calc_reserved_for_variant(p_variant_id);

  UPDATE public.inventory
     SET reserved_quantity = v_correct,
         last_updated_by = COALESCE(last_updated_by, 'system-reserved-sync'),
         updated_at = now()
   WHERE variant_id = p_variant_id
     AND reserved_quantity IS DISTINCT FROM v_correct;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_reserved_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOR v_variant IN SELECT DISTINCT variant_id FROM public.order_items WHERE order_id = OLD.id AND variant_id IS NOT NULL LOOP
      PERFORM public.sync_reserved_for_variant(v_variant);
    END LOOP;
    RETURN OLD;
  ELSE
    FOR v_variant IN SELECT DISTINCT variant_id FROM public.order_items WHERE order_id = NEW.id AND variant_id IS NOT NULL LOOP
      PERFORM public.sync_reserved_for_variant(v_variant);
    END LOOP;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_reserved_from_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_reserved_for_variant(OLD.variant_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_reserved_for_variant(NEW.variant_id);
    IF TG_OP = 'UPDATE' AND OLD.variant_id IS DISTINCT FROM NEW.variant_id THEN
      PERFORM public.sync_reserved_for_variant(OLD.variant_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Drop legacy reserved triggers that cause double-counting / drift
DROP TRIGGER IF EXISTS reserve_stock_on_order_create_trigger ON public.orders;
DROP TRIGGER IF EXISTS update_reserved_on_order_status_change ON public.orders;

-- Install unified triggers (named zzz_ to ensure they run last and have final say)
DROP TRIGGER IF EXISTS zzz_unified_sync_reserved_orders ON public.orders;
CREATE TRIGGER zzz_unified_sync_reserved_orders
AFTER INSERT OR UPDATE OF status, delivery_status, isarchived OR DELETE
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_reserved_from_order();

DROP TRIGGER IF EXISTS zzz_unified_sync_reserved_items ON public.order_items;
CREATE TRIGGER zzz_unified_sync_reserved_items
AFTER INSERT OR UPDATE OF variant_id, quantity, item_status, item_direction OR DELETE
ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_reserved_from_item();

-- ONE-TIME rebuild of all reserved_quantity values from reality
UPDATE public.inventory inv
   SET reserved_quantity = public.calc_reserved_for_variant(inv.variant_id),
       last_updated_by = COALESCE(inv.last_updated_by, 'system-reserved-rebuild'),
       updated_at = now()
 WHERE inv.variant_id IS NOT NULL
   AND inv.reserved_quantity IS DISTINCT FROM public.calc_reserved_for_variant(inv.variant_id);

-- ============================================================
-- PART 2: STOREFRONT — expand theme list + custom domain
-- ============================================================

ALTER TABLE public.employee_storefront_settings
  DROP CONSTRAINT IF EXISTS employee_storefront_settings_theme_name_check;

ALTER TABLE public.employee_storefront_settings
  ADD CONSTRAINT employee_storefront_settings_theme_name_check
  CHECK (theme_name IN (
    'modern','classic','minimal','luxury',
    'glass-luxury','glass-noir','glass-aurora','glass-minimal',
    'neon-cyber','editorial-soft','vibrant-pop','nature-calm'
  ));

ALTER TABLE public.employee_storefront_settings
  ALTER COLUMN theme_name SET DEFAULT 'glass-luxury';

ALTER TABLE public.employee_storefront_settings
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS employee_storefront_settings_custom_domain_uidx
  ON public.employee_storefront_settings (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;
