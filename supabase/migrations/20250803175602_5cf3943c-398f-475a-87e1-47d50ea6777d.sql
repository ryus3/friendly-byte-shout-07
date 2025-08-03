-- إصلاح فئات الولاء وتحديث النقاط المطلوبة
UPDATE loyalty_tiers 
SET points_required = CASE 
  WHEN name = 'برونزي' OR name_en = 'Bronze' THEN 0
  WHEN name = 'فضي' OR name_en = 'Silver' THEN 750
  WHEN name = 'ذهبي' OR name_en = 'Gold' THEN 1500
  WHEN name = 'ماسي' OR name_en = 'Diamond' THEN 3000
  ELSE points_required
END
WHERE name IN ('برونزي', 'فضي', 'ذهبي', 'ماسي') 
   OR name_en IN ('Bronze', 'Silver', 'Gold', 'Diamond');

-- التأكد من وجود جميع الفئات المطلوبة
INSERT INTO loyalty_tiers (name, name_en, points_required, benefits, discount_percentage, is_active)
VALUES 
  ('برونزي', 'Bronze', 0, 'نقاط أساسية', 0, true),
  ('فضي', 'Silver', 750, 'خصم 5% + نقاط مضاعفة', 5, true),
  ('ذهبي', 'Gold', 1500, 'خصم 10% + شحن مجاني', 10, true),
  ('ماسي', 'Diamond', 3000, 'خصم 15% + مزايا حصرية', 15, true)
ON CONFLICT (name) DO UPDATE SET
  points_required = EXCLUDED.points_required,
  benefits = EXCLUDED.benefits,
  discount_percentage = EXCLUDED.discount_percentage,
  is_active = EXCLUDED.is_active;

-- تحديث مستويات العملاء الحاليين حسب النقاط الصحيحة
UPDATE customer_loyalty 
SET current_tier_id = (
  SELECT id FROM loyalty_tiers 
  WHERE points_required <= customer_loyalty.total_points
  ORDER BY points_required DESC
  LIMIT 1
),
updated_at = now();