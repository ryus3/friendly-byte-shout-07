-- 1) تنظيف التكرارات: نُبقي أحدث صف لكل (delivery_partner, external_id)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY delivery_partner, external_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.region_delivery_mappings
)
DELETE FROM public.region_delivery_mappings r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

-- 2) إسقاط القيد القديم
ALTER TABLE public.region_delivery_mappings
  DROP CONSTRAINT IF EXISTS region_delivery_mappings_region_id_delivery_partner_key;

-- 3) القيد الجديد
ALTER TABLE public.region_delivery_mappings
  ADD CONSTRAINT region_delivery_mappings_partner_external_id_key
  UNIQUE (delivery_partner, external_id);

-- 4) فهرس بحث مساعد
CREATE INDEX IF NOT EXISTS idx_region_delivery_mappings_region_partner
  ON public.region_delivery_mappings (region_id, delivery_partner);
