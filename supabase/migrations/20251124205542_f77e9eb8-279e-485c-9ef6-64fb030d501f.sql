-- Migration: Employee Storefront Builder Platform - Complete Database Schema
-- Created: 2025-11-24

-- ====================================================================
-- 1. EMPLOYEE STOREFRONT SETTINGS - إعدادات المتجر
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_storefront_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  
  -- Theme & Branding
  theme_name TEXT NOT NULL DEFAULT 'modern' CHECK (theme_name IN ('modern', 'classic', 'minimal', 'luxury')),
  primary_color TEXT NOT NULL DEFAULT '#3b82f6',
  secondary_color TEXT NOT NULL DEFAULT '#8b5cf6',
  accent_color TEXT NOT NULL DEFAULT '#10b981',
  font_family TEXT NOT NULL DEFAULT 'Cairo',
  
  -- Assets
  logo_url TEXT,
  banner_url TEXT,
  
  -- Customization
  custom_css TEXT,
  layout_config JSONB DEFAULT '{"show_hero": true, "show_deals": true, "show_featured": true}'::jsonb,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(employee_id)
);

-- RLS Policies
ALTER TABLE employee_storefront_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own storefront"
ON employee_storefront_settings
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active storefronts"
ON employee_storefront_settings
FOR SELECT
USING (is_active = true);

-- Index for slug lookup
CREATE INDEX idx_storefront_slug ON employee_storefront_settings(slug);

-- ====================================================================
-- 2. EMPLOYEE PROMOTIONS - العروض والخصومات
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Promotion Details
  promotion_name TEXT NOT NULL,
  promotion_type TEXT NOT NULL CHECK (promotion_type IN ('percentage', 'fixed_amount', 'buy_x_get_y')),
  discount_value NUMERIC NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  
  -- Applicability
  applicable_products UUID[], -- NULL means all products
  applicable_categories UUID[],
  
  -- Timing
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  
  -- Promo Code
  promotion_code TEXT UNIQUE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE employee_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own promotions"
ON employee_promotions
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active promotions"
ON employee_promotions
FOR SELECT
USING (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

-- Index for active promotions lookup
CREATE INDEX idx_promotions_active ON employee_promotions(employee_id, is_active, start_date, end_date);

-- ====================================================================
-- 3. EMPLOYEE BANNERS - البنرات الإعلانية
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Banner Content
  banner_image TEXT NOT NULL,
  banner_link TEXT,
  banner_title TEXT,
  banner_subtitle TEXT,
  
  -- Position & Order
  banner_position TEXT NOT NULL DEFAULT 'hero' CHECK (banner_position IN ('hero', 'sidebar', 'popup', 'announcement_bar')),
  display_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE employee_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own banners"
ON employee_banners
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view active banners"
ON employee_banners
FOR SELECT
USING (is_active = true);

-- Index for ordered banners
CREATE INDEX idx_banners_order ON employee_banners(employee_id, banner_position, display_order);

-- ====================================================================
-- 4. EMPLOYEE PRODUCT DESCRIPTIONS - أوصاف مخصصة
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_product_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Custom Content
  custom_description TEXT,
  custom_images TEXT[], -- Additional images URLs
  size_chart_url TEXT,
  
  -- Display Settings
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(employee_id, product_id)
);

-- RLS Policies
ALTER TABLE employee_product_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own product descriptions"
ON employee_product_descriptions
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can view product descriptions"
ON employee_product_descriptions
FOR SELECT
USING (true);

-- Index for featured products
CREATE INDEX idx_product_descriptions_featured ON employee_product_descriptions(employee_id, is_featured, display_order);

-- ====================================================================
-- 5. STOREFRONT ANALYTICS - الإحصائيات
-- ====================================================================
CREATE TABLE IF NOT EXISTS storefront_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Date
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Traffic Metrics
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  
  -- Product Metrics
  product_views JSONB DEFAULT '{}'::jsonb, -- {"product_id": view_count}
  
  -- Conversion Metrics
  add_to_cart_count INTEGER DEFAULT 0,
  orders_placed INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  
  -- Traffic Sources
  traffic_sources JSONB DEFAULT '{"direct": 0, "social": 0, "search": 0, "other": 0}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(employee_id, date)
);

-- RLS Policies
ALTER TABLE storefront_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
ON storefront_analytics
FOR SELECT
USING (employee_id = auth.uid());

CREATE POLICY "System can insert analytics"
ON storefront_analytics
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update analytics"
ON storefront_analytics
FOR UPDATE
USING (true);

-- Index for date range queries
CREATE INDEX idx_analytics_date ON storefront_analytics(employee_id, date DESC);

-- ====================================================================
-- 6. EMPLOYEE MARKETING PIXELS - Pixel IDs
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_marketing_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pixel IDs
  meta_pixel_id TEXT, -- Facebook/Instagram
  tiktok_pixel_id TEXT,
  google_analytics_id TEXT,
  snapchat_pixel_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(employee_id)
);

-- RLS Policies
ALTER TABLE employee_marketing_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pixels"
ON employee_marketing_pixels
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

-- ====================================================================
-- 7. EMPLOYEE DOMAINS - Custom Domains
-- ====================================================================
CREATE TABLE IF NOT EXISTS employee_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Domain Info
  domain_name TEXT UNIQUE NOT NULL,
  
  -- Verification
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  dns_records JSONB, -- A, CNAME records for verification
  
  -- SSL
  ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'issued', 'failed')),
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE employee_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own domains"
ON employee_domains
FOR ALL
USING (employee_id = auth.uid())
WITH CHECK (employee_id = auth.uid());

-- ====================================================================
-- 8. STOREFRONT ORDERS - طلبات المتجر
-- ====================================================================
CREATE TABLE IF NOT EXISTS storefront_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Source Tracking
  storefront_source TEXT NOT NULL DEFAULT 'website' CHECK (storefront_source IN ('website', 'instagram', 'facebook', 'tiktok')),
  customer_session_id TEXT,
  
  -- Marketing Attribution
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(order_id)
);

-- RLS Policies
ALTER TABLE storefront_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view storefront orders"
ON storefront_orders
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert storefront orders"
ON storefront_orders
FOR INSERT
WITH CHECK (true);

-- Index for source analytics
CREATE INDEX idx_storefront_orders_source ON storefront_orders(storefront_source, created_at DESC);

-- ====================================================================
-- 9. ADD STOREFRONT PERMISSIONS TO PROFILES
-- ====================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_storefront_access BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_upload_custom_images BOOLEAN DEFAULT false;

-- ====================================================================
-- 10. HELPER FUNCTIONS
-- ====================================================================

-- Function: Get active promotions for employee
CREATE OR REPLACE FUNCTION get_active_promotions(p_employee_id UUID)
RETURNS TABLE (
  id UUID,
  promotion_name TEXT,
  promotion_type TEXT,
  discount_value NUMERIC,
  applicable_products UUID[],
  applicable_categories UUID[],
  promotion_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.id,
    ep.promotion_name,
    ep.promotion_type,
    ep.discount_value,
    ep.applicable_products,
    ep.applicable_categories,
    ep.promotion_code
  FROM employee_promotions ep
  WHERE ep.employee_id = p_employee_id
    AND ep.is_active = true
    AND ep.start_date <= now()
    AND (ep.end_date IS NULL OR ep.end_date >= now());
END;
$$;

-- Function: Calculate promotion discount for product
CREATE OR REPLACE FUNCTION calculate_promotion_discount(
  p_employee_id UUID,
  p_product_id UUID,
  p_original_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_discount NUMERIC := 0;
  v_promotion RECORD;
BEGIN
  -- Find applicable promotion
  SELECT * INTO v_promotion
  FROM employee_promotions
  WHERE employee_id = p_employee_id
    AND is_active = true
    AND start_date <= now()
    AND (end_date IS NULL OR end_date >= now())
    AND (
      applicable_products IS NULL 
      OR p_product_id = ANY(applicable_products)
    )
  ORDER BY discount_value DESC
  LIMIT 1;
  
  IF v_promotion.id IS NOT NULL THEN
    IF v_promotion.promotion_type = 'percentage' THEN
      v_discount := p_original_price * (v_promotion.discount_value / 100);
    ELSIF v_promotion.promotion_type = 'fixed_amount' THEN
      v_discount := v_promotion.discount_value;
    END IF;
  END IF;
  
  RETURN COALESCE(v_discount, 0);
END;
$$;

-- ====================================================================
-- COMMENTS FOR DOCUMENTATION
-- ====================================================================
COMMENT ON TABLE employee_storefront_settings IS 'إعدادات المتجر الإلكتروني لكل موظف - Theme، Colors، Logo، SEO';
COMMENT ON TABLE employee_promotions IS 'العروض والخصومات التي يقدمها الموظف في متجره';
COMMENT ON TABLE employee_banners IS 'البنرات الإعلانية والصور الترويجية في المتجر';
COMMENT ON TABLE employee_product_descriptions IS 'أوصاف وصور مخصصة للمنتجات في متجر كل موظف';
COMMENT ON TABLE storefront_analytics IS 'إحصائيات الزوار والمبيعات لكل متجر';
COMMENT ON TABLE employee_marketing_pixels IS 'معرفات البكسل التسويقي (Facebook، TikTok، Google Analytics)';
COMMENT ON TABLE employee_domains IS 'النطاقات المخصصة للمتاجر (Custom Domains)';
COMMENT ON TABLE storefront_orders IS 'معلومات إضافية عن طلبات المتجر (Source، UTM Tracking)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Employee Storefront Platform - Database Schema Created Successfully!';
  RAISE NOTICE '📊 Tables: 8 new tables + 2 profile columns';
  RAISE NOTICE '🔒 RLS Policies: Applied on all tables';
  RAISE NOTICE '⚡ Helper Functions: 2 functions for promotions';
END $$;