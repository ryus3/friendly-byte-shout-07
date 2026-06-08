
-- Backup snapshot
CREATE TABLE IF NOT EXISTS public.inventory_reserved_backup_20260608 AS
SELECT id, variant_id, product_id, quantity, reserved_quantity, now() AS backed_up_at
FROM public.inventory;

GRANT SELECT ON public.inventory_reserved_backup_20260608 TO authenticated;
GRANT ALL ON public.inventory_reserved_backup_20260608 TO service_role;

-- Recompute reserved_quantity for ALL inventory rows using the unified function
UPDATE public.inventory i
SET reserved_quantity = public.calc_reserved_for_variant(i.variant_id),
    updated_at = now()
WHERE i.reserved_quantity IS DISTINCT FROM public.calc_reserved_for_variant(i.variant_id);
