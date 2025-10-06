-- إصلاح التحذيرات الأمنية لجداول النسخ الاحتياطي

-- تفعيل RLS للجداول الاحتياطية
ALTER TABLE cities_cache_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions_cache_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_aliases_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_aliases_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders_backup ENABLE ROW LEVEL SECURITY;

-- سياسات للمديرين فقط (النسخ الاحتياطية حساسة)
CREATE POLICY "المديرون فقط يرون backup المدن" ON cities_cache_backup FOR SELECT TO authenticated USING (is_admin_or_deputy());
CREATE POLICY "المديرون فقط يرون backup المناطق" ON regions_cache_backup FOR SELECT TO authenticated USING (is_admin_or_deputy());
CREATE POLICY "المديرون فقط يرون backup مرادفات المدن" ON city_aliases_backup FOR SELECT TO authenticated USING (is_admin_or_deputy());
CREATE POLICY "المديرون فقط يرون backup مرادفات المناطق" ON region_aliases_backup FOR SELECT TO authenticated USING (is_admin_or_deputy());
CREATE POLICY "المديرون فقط يرون backup الطلبات" ON orders_backup FOR SELECT TO authenticated USING (is_admin_or_deputy());