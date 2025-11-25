-- المرحلة 5: تطوير صفحة المنتجات - إضافة أعمدة جديدة
-- إضافة حقول للخصم والمنتجات المخصصة
ALTER TABLE employee_product_descriptions
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS custom_colors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_sizes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_custom_product BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_price DECIMAL(10,2);

-- جدول جديد للمنتجات المخصصة الخاصة بالموظف
CREATE TABLE IF NOT EXISTS employee_custom_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  colors JSONB DEFAULT '[]'::jsonb,
  sizes JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  stock_quantity INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS لحماية البيانات
ALTER TABLE employee_custom_products ENABLE ROW LEVEL SECURITY;

-- حذف policies القديمة إن وجدت
DROP POLICY IF EXISTS "Users can view own custom products" ON employee_custom_products;
DROP POLICY IF EXISTS "Users can insert own custom products" ON employee_custom_products;
DROP POLICY IF EXISTS "Users can update own custom products" ON employee_custom_products;
DROP POLICY IF EXISTS "Users can delete own custom products" ON employee_custom_products;

-- إنشاء policies جديدة
CREATE POLICY "Users can view own custom products"
  ON employee_custom_products FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Users can insert own custom products"
  ON employee_custom_products FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Users can update own custom products"
  ON employee_custom_products FOR UPDATE
  USING (employee_id = auth.uid());

CREATE POLICY "Users can delete own custom products"
  ON employee_custom_products FOR DELETE
  USING (employee_id = auth.uid());

-- المرحلة 6: الإعدادات المتقدمة - إضافة أعمدة الهيدر
ALTER TABLE employee_storefront_settings
ADD COLUMN IF NOT EXISTS header_style VARCHAR(50) DEFAULT 'modern',
ADD COLUMN IF NOT EXISTS show_search BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_categories BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS announcement_bar_text TEXT,
ADD COLUMN IF NOT EXISTS announcement_bar_enabled BOOLEAN DEFAULT FALSE;

-- جدول الأقسام المخصصة
CREATE TABLE IF NOT EXISTS employee_storefront_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  section_type VARCHAR(50) NOT NULL,
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  display_order INT DEFAULT 0,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الإعلانات المنبثقة
CREATE TABLE IF NOT EXISTS employee_storefront_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  cta_text TEXT,
  cta_link TEXT,
  display_delay INT DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول البروموكود
CREATE TABLE IF NOT EXISTS employee_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase_amount DECIMAL(10,2),
  max_uses INT,
  current_uses INT DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies لجميع الجداول الجديدة
ALTER TABLE employee_storefront_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_storefront_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_promo_codes ENABLE ROW LEVEL SECURITY;

-- حذف policies القديمة
DROP POLICY IF EXISTS "Users can manage own sections" ON employee_storefront_sections;
DROP POLICY IF EXISTS "Users can manage own popups" ON employee_storefront_popups;
DROP POLICY IF EXISTS "Users can manage own promo codes" ON employee_promo_codes;
DROP POLICY IF EXISTS "Public can view active sections" ON employee_storefront_sections;
DROP POLICY IF EXISTS "Public can view active popups" ON employee_storefront_popups;
DROP POLICY IF EXISTS "Public can view active promo codes" ON employee_promo_codes;

-- Policies للأقسام
CREATE POLICY "Users can manage own sections"
  ON employee_storefront_sections FOR ALL
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active sections"
  ON employee_storefront_sections FOR SELECT
  USING (is_enabled = true);

-- Policies للإعلانات
CREATE POLICY "Users can manage own popups"
  ON employee_storefront_popups FOR ALL
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active popups"
  ON employee_storefront_popups FOR SELECT
  USING (is_active = true);

-- Policies للبروموكود
CREATE POLICY "Users can manage own promo codes"
  ON employee_promo_codes FOR ALL
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active promo codes"
  ON employee_promo_codes FOR SELECT
  USING (is_active = true);

-- المرحلة 7: ربط نظام الولاء
-- إضافة customer_phone_id إلى جدول storefront_orders
ALTER TABLE storefront_orders
ADD COLUMN IF NOT EXISTS customer_phone_id UUID REFERENCES customer_phone_loyalty(id);

-- Trigger لإضافة نقاط ولاء عند اكتمال الطلب
CREATE OR REPLACE FUNCTION add_loyalty_points_on_storefront_order()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_to_add INT;
BEGIN
  -- عندما يتم تسليم الطلب
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- حساب النقاط (1 نقطة لكل 1000 IQD)
    v_points_to_add := FLOOR(NEW.total_amount / 1000);

    -- إضافة النقاط للعميل
    IF NEW.customer_phone_id IS NOT NULL THEN
      UPDATE customer_phone_loyalty
      SET 
        total_points = total_points + v_points_to_add,
        total_orders = total_orders + 1,
        total_spent = total_spent + NEW.total_amount,
        last_order_date = NOW()
      WHERE id = NEW.customer_phone_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- حذف trigger القديم إن وجد
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON storefront_orders;

-- إنشاء trigger جديد
CREATE TRIGGER trigger_add_loyalty_points
AFTER UPDATE ON storefront_orders
FOR EACH ROW
EXECUTE FUNCTION add_loyalty_points_on_storefront_order();

COMMENT ON FUNCTION add_loyalty_points_on_storefront_order() IS 
'يضيف نقاط ولاء للعميل عند تسليم طلب المتجر الإلكتروني - متكامل مع نظام الولاء الموحد';