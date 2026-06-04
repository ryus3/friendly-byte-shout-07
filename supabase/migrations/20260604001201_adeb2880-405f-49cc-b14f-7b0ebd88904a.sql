
-- 1) One-time sync: align all variants to their product's base_price/cost_price
UPDATE product_variants v
SET price = p.base_price,
    cost_price = COALESCE(p.cost_price, v.cost_price),
    updated_at = now()
FROM products p
WHERE v.product_id = p.id
  AND p.base_price IS NOT NULL
  AND (v.price IS DISTINCT FROM p.base_price
       OR (p.cost_price IS NOT NULL AND v.cost_price IS DISTINCT FROM p.cost_price));

-- 2) Trigger: whenever products.base_price or cost_price changes, propagate to variants
CREATE OR REPLACE FUNCTION public.sync_variant_prices_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.base_price IS DISTINCT FROM OLD.base_price)
     OR (NEW.cost_price IS DISTINCT FROM OLD.cost_price) THEN
    UPDATE product_variants
    SET price = NEW.base_price,
        cost_price = COALESCE(NEW.cost_price, cost_price),
        updated_at = now()
    WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_variant_prices_from_product ON public.products;
CREATE TRIGGER trg_sync_variant_prices_from_product
AFTER UPDATE OF base_price, cost_price ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_variant_prices_from_product();
