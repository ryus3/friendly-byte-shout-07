-- Fix 1: add a computed available_quantity column so any existing DB functions
-- that read inventory.available_quantity will work correctly.
-- It is always derived from quantity - reserved_quantity and never negative.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS available_quantity integer
  GENERATED ALWAYS AS (GREATEST(quantity - reserved_quantity, 0)) STORED;

-- Fix 2: eliminate COALESCE uuid/text mismatches on inventory.last_updated_by
-- by ensuring the column type matches any existing uses of auth.uid()::text
-- in PL/pgSQL functions that write to this column.

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_last_updated_by_fkey;

ALTER TABLE public.inventory
  ALTER COLUMN last_updated_by TYPE text
  USING last_updated_by::text;
