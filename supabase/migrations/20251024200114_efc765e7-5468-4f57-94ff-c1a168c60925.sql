-- ===================================================
-- إنشاء جدول كاش المنتجات الدائم في قاعدة البيانات
-- ===================================================

-- 1. إنشاء جدول products_cache
CREATE TABLE IF NOT EXISTS products_cache (
  id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  base_price integer,
  colors jsonb DEFAULT '[]'::jsonb,
  sizes jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 2. Indexes للأداء
-- Index للبحث السريع باستخدام Trigram
CREATE INDEX IF NOT EXISTS idx_products_cache_name_trgm 
  ON products_cache USING gin(normalized_name gin_trgm_ops);

-- Index عادي للبحث
CREATE INDEX IF NOT EXISTS idx_products_cache_normalized 
  ON products_cache(normalized_name);

-- Index للتحديث التلقائي
CREATE INDEX IF NOT EXISTS idx_products_cache_updated_at 
  ON products_cache(updated_at);

-- 3. RLS Policies
ALTER TABLE products_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "المستخدمون يرون كاش المنتجات" ON products_cache;
CREATE POLICY "المستخدمون يرون كاش المنتجات"
  ON products_cache FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "المديرون يديرون كاش المنتجات" ON products_cache;
CREATE POLICY "المديرون يديرون كاش المنتجات"
  ON products_cache FOR ALL
  USING (is_admin_or_deputy());

-- 4. Function لتحديث الكاش تلقائياً عند إضافة/تعديل منتج
CREATE OR REPLACE FUNCTION refresh_product_cache_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id uuid;
BEGIN
  -- تحديد ID المنتج
  IF (TG_TABLE_NAME = 'products') THEN
    v_product_id := COALESCE(NEW.id, OLD.id);
  ELSIF (TG_TABLE_NAME = 'product_variants') THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  END IF;

  -- حذف الكاش الخاص بالمنتج
  DELETE FROM products_cache WHERE id = v_product_id;
  
  -- إعادة بناء الكاش للمنتج (إذا كان نشطاً ولم يُحذف)
  IF (TG_OP != 'DELETE') THEN
    INSERT INTO products_cache (id, name, normalized_name, base_price, colors, sizes)
    SELECT 
      p.id,
      p.name,
      LOWER(TRIM(p.name)) as normalized_name,
      p.base_price,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) 
        FILTER (WHERE c.id IS NOT NULL),
        '[]'::jsonb
      ) as colors,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) 
        FILTER (WHERE s.id IS NOT NULL),
        '[]'::jsonb
      ) as sizes
    FROM products p
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN colors c ON c.id = pv.color_id
    LEFT JOIN sizes s ON s.id = pv.size_id
    WHERE p.id = v_product_id AND p.is_active = true
    GROUP BY p.id, p.name, p.base_price
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. Triggers على جدول products
DROP TRIGGER IF EXISTS trg_refresh_cache_on_product_change ON products;
CREATE TRIGGER trg_refresh_cache_on_product_change
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION refresh_product_cache_on_change();

-- 6. Triggers على جدول product_variants
DROP TRIGGER IF EXISTS trg_refresh_cache_on_variant_change ON product_variants;
CREATE TRIGGER trg_refresh_cache_on_variant_change
AFTER INSERT OR UPDATE OR DELETE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION refresh_product_cache_on_change();

-- 7. Function لإعادة بناء الكاش بالكامل (للـ Cron Job)
CREATE OR REPLACE FUNCTION rebuild_products_cache()
RETURNS void AS $$
BEGIN
  -- حذف الكاش القديم
  TRUNCATE products_cache;
  
  -- إعادة بناء الكاش بالكامل
  INSERT INTO products_cache (id, name, normalized_name, base_price, colors, sizes)
  SELECT 
    p.id,
    p.name,
    LOWER(TRIM(p.name)) as normalized_name,
    p.base_price,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)) 
      FILTER (WHERE c.id IS NOT NULL),
      '[]'::jsonb
    ) as colors,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) 
      FILTER (WHERE s.id IS NOT NULL),
      '[]'::jsonb
    ) as sizes
  FROM products p
  LEFT JOIN product_variants pv ON pv.product_id = p.id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  WHERE p.is_active = true
  GROUP BY p.id, p.name, p.base_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. إنشاء Cron Job (تحديث كل 7 أيام - الأحد 2 صباحاً)
SELECT cron.schedule(
  'refresh-products-cache-weekly',
  '0 2 * * 0',
  $$SELECT rebuild_products_cache();$$
);