-- 1. إنشاء جدول المنتجات المسموحة للمتجر
CREATE TABLE IF NOT EXISTS employee_allowed_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(user_id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  UNIQUE(employee_id, product_id)
);

-- 2. إضافة حقل is_in_storefront لجدول تخصيصات المنتجات
ALTER TABLE employee_product_descriptions
ADD COLUMN IF NOT EXISTS is_in_storefront BOOLEAN DEFAULT false;

-- 3. تفعيل RLS على جدول المنتجات المسموحة
ALTER TABLE employee_allowed_products ENABLE ROW LEVEL SECURITY;

-- 4. سياسات RLS للمنتجات المسموحة
CREATE POLICY "Admins manage all allowed products" ON employee_allowed_products
  FOR ALL USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

CREATE POLICY "Employees view own allowed products" ON employee_allowed_products
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Employees update own allowed products storefront status" ON employee_allowed_products
  FOR UPDATE USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- 5. سياسات RLS للقراءة العامة (للمتجر)
-- السماح للجميع بقراءة المنتجات النشطة
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (is_active = true);

-- السماح للجميع بقراءة variants المنتجات النشطة
DROP POLICY IF EXISTS "Public can view product variants" ON product_variants;
CREATE POLICY "Public can view product variants" ON product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_variants.product_id 
      AND products.is_active = true
    )
  );

-- السماح للجميع بقراءة المخزون
DROP POLICY IF EXISTS "Public can view inventory" ON inventory;
CREATE POLICY "Public can view inventory" ON inventory
  FOR SELECT USING (true);

-- السماح للجميع بقراءة الأقسام النشطة
DROP POLICY IF EXISTS "Public can view active departments" ON departments;
CREATE POLICY "Public can view active departments" ON departments
  FOR SELECT USING (is_active = true);

-- السماح للعامة بقراءة تخصيصات المنتجات للمتاجر
DROP POLICY IF EXISTS "Public can view storefront product descriptions" ON employee_product_descriptions;
CREATE POLICY "Public can view storefront product descriptions" ON employee_product_descriptions
  FOR SELECT USING (is_in_storefront = true);

-- السماح للعامة بقراءة المنتجات المسموحة للمتاجر
DROP POLICY IF EXISTS "Public can view allowed products for storefronts" ON employee_allowed_products;
CREATE POLICY "Public can view allowed products for storefronts" ON employee_allowed_products
  FOR SELECT USING (is_active = true);

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_employee_allowed_products_employee ON employee_allowed_products(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_allowed_products_product ON employee_allowed_products(product_id);
CREATE INDEX IF NOT EXISTS idx_employee_product_descriptions_storefront ON employee_product_descriptions(employee_id, is_in_storefront) WHERE is_in_storefront = true;