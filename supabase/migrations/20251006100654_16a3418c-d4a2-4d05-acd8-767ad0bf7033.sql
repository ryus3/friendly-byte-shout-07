-- ============================================
-- المرحلة 1: النسخ الاحتياطي الكامل
-- ============================================

-- نسخ احتياطي للجداول الحالية
CREATE TABLE IF NOT EXISTS cities_cache_backup AS SELECT * FROM cities_cache;
CREATE TABLE IF NOT EXISTS regions_cache_backup AS SELECT * FROM regions_cache;
CREATE TABLE IF NOT EXISTS city_aliases_backup AS SELECT * FROM city_aliases;
CREATE TABLE IF NOT EXISTS region_aliases_backup AS SELECT * FROM region_aliases;
CREATE TABLE IF NOT EXISTS orders_backup AS 
  SELECT * FROM orders WHERE created_at > now() - interval '30 days';

-- ============================================
-- المرحلة 2: إنشاء الجداول الجديدة
-- ============================================

-- جدول المدن الموحد (سيستخدم alwaseet_id كمعرف موحد)
CREATE TABLE IF NOT EXISTS cities_master (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  alwaseet_id INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول ربط المدن بشركات التوصيل
CREATE TABLE IF NOT EXISTS city_delivery_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id INTEGER NOT NULL REFERENCES cities_master(id) ON DELETE CASCADE,
  delivery_partner TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, delivery_partner)
);

-- جدول المناطق الموحد (سيستخدم alwaseet_id كمعرف موحد)
CREATE TABLE IF NOT EXISTS regions_master (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city_id INTEGER NOT NULL REFERENCES cities_master(id) ON DELETE CASCADE,
  alwaseet_id INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول ربط المناطق بشركات التوصيل
CREATE TABLE IF NOT EXISTS region_delivery_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL REFERENCES regions_master(id) ON DELETE CASCADE,
  delivery_partner TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(region_id, delivery_partner)
);

-- ============================================
-- المرحلة 3: نقل البيانات بدقة
-- ============================================

-- نقل المدن
INSERT INTO cities_master (id, name, name_ar, name_en, alwaseet_id, is_active, created_at, updated_at)
SELECT 
  alwaseet_id, name, name_ar, name_en, alwaseet_id, is_active, created_at, updated_at
FROM cities_cache
ON CONFLICT (id) DO NOTHING;

-- mappings المدن
INSERT INTO city_delivery_mappings (city_id, delivery_partner, external_id, external_name, is_active)
SELECT alwaseet_id, 'alwaseet', alwaseet_id::TEXT, name, is_active
FROM cities_cache
ON CONFLICT (city_id, delivery_partner) DO UPDATE SET
  external_id = EXCLUDED.external_id, external_name = EXCLUDED.external_name,
  is_active = EXCLUDED.is_active, updated_at = now();

-- نقل المناطق
INSERT INTO regions_master (id, name, city_id, alwaseet_id, is_active, created_at, updated_at)
SELECT r.alwaseet_id, r.name, c.alwaseet_id, r.alwaseet_id, r.is_active, r.created_at, r.updated_at
FROM regions_cache r
JOIN cities_cache c ON r.city_id = c.id
ON CONFLICT (id) DO NOTHING;

-- mappings المناطق
INSERT INTO region_delivery_mappings (region_id, delivery_partner, external_id, external_name, is_active)
SELECT r.alwaseet_id, 'alwaseet', r.alwaseet_id::TEXT, r.name, r.is_active
FROM regions_cache r
ON CONFLICT (region_id, delivery_partner) DO UPDATE SET
  external_id = EXCLUDED.external_id, external_name = EXCLUDED.external_name,
  is_active = EXCLUDED.is_active, updated_at = now();

-- تحديث المرادفات
UPDATE region_aliases ra
SET region_id = r_new.id
FROM regions_cache r_old
JOIN regions_master r_new ON r_old.alwaseet_id = r_new.id
WHERE ra.region_id = r_old.id;

UPDATE city_aliases ca
SET city_id = c_new.id
FROM cities_cache c_old
JOIN cities_master c_new ON c_old.alwaseet_id = c_new.id
WHERE ca.city_id = c_old.id;

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_cities_master_alwaseet ON cities_master(alwaseet_id);
CREATE INDEX IF NOT EXISTS idx_regions_master_city ON regions_master(city_id);
CREATE INDEX IF NOT EXISTS idx_regions_master_alwaseet ON regions_master(alwaseet_id);
CREATE INDEX IF NOT EXISTS idx_city_mappings_city ON city_delivery_mappings(city_id);
CREATE INDEX IF NOT EXISTS idx_city_mappings_partner ON city_delivery_mappings(delivery_partner);
CREATE INDEX IF NOT EXISTS idx_region_mappings_region ON region_delivery_mappings(region_id);
CREATE INDEX IF NOT EXISTS idx_region_mappings_partner ON region_delivery_mappings(delivery_partner);

-- دوال مساعدة
CREATE OR REPLACE FUNCTION get_city_external_id(p_city_id INTEGER, p_delivery_partner TEXT DEFAULT 'alwaseet')
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_external_id TEXT;
BEGIN
  SELECT external_id INTO v_external_id FROM city_delivery_mappings
  WHERE city_id = p_city_id AND delivery_partner = p_delivery_partner AND is_active = true;
  RETURN v_external_id;
END; $$;

CREATE OR REPLACE FUNCTION get_region_external_id(p_region_id INTEGER, p_delivery_partner TEXT DEFAULT 'alwaseet')
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_external_id TEXT;
BEGIN
  SELECT external_id INTO v_external_id FROM region_delivery_mappings
  WHERE region_id = p_region_id AND delivery_partner = p_delivery_partner AND is_active = true;
  RETURN v_external_id;
END; $$;

-- RLS Policies
ALTER TABLE cities_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المستخدمون يرون المدن الموحدة" ON cities_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "المديرون يديرون المدن الموحدة" ON cities_master FOR ALL TO authenticated USING (is_admin_or_deputy()) WITH CHECK (is_admin_or_deputy());

ALTER TABLE regions_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المستخدمون يرون المناطق الموحدة" ON regions_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "المديرون يديرون المناطق الموحدة" ON regions_master FOR ALL TO authenticated USING (is_admin_or_deputy()) WITH CHECK (is_admin_or_deputy());

ALTER TABLE city_delivery_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المستخدمون يرون mappings المدن" ON city_delivery_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "المديرون يديرون mappings المدن" ON city_delivery_mappings FOR ALL TO authenticated USING (is_admin_or_deputy()) WITH CHECK (is_admin_or_deputy());

ALTER TABLE region_delivery_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المستخدمون يرون mappings المناطق" ON region_delivery_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "المديرون يديرون mappings المناطق" ON region_delivery_mappings FOR ALL TO authenticated USING (is_admin_or_deputy()) WITH CHECK (is_admin_or_deputy());