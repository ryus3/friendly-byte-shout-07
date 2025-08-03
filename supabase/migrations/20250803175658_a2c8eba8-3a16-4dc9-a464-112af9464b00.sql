-- إصلاح فئات الولاء بالأعمدة الصحيحة
UPDATE loyalty_tiers 
SET points_required = CASE 
  WHEN name = 'برونزي' OR name_en = 'Bronze' THEN 0
  WHEN name = 'فضي' OR name_en = 'Silver' THEN 750
  WHEN name = 'ذهبي' OR name_en = 'Gold' THEN 1500
  WHEN name = 'ماسي' OR name_en = 'Diamond' THEN 3000
  ELSE points_required
END,
discount_percentage = CASE 
  WHEN name = 'برونزي' OR name_en = 'Bronze' THEN 0
  WHEN name = 'فضي' OR name_en = 'Silver' THEN 5
  WHEN name = 'ذهبي' OR name_en = 'Gold' THEN 10
  WHEN name = 'ماسي' OR name_en = 'Diamond' THEN 15
  ELSE discount_percentage
END,
special_benefits = CASE 
  WHEN name = 'برونزي' OR name_en = 'Bronze' THEN '{"features": ["نقاط أساسية"]}'::jsonb
  WHEN name = 'فضي' OR name_en = 'Silver' THEN '{"features": ["خصم 5%", "نقاط مضاعفة"]}'::jsonb
  WHEN name = 'ذهبي' OR name_en = 'Gold' THEN '{"features": ["خصم 10%", "شحن مجاني"]}'::jsonb
  WHEN name = 'ماسي' OR name_en = 'Diamond' THEN '{"features": ["خصم 15%", "مزايا حصرية", "أولوية الدعم"]}'::jsonb
  ELSE special_benefits
END
WHERE name IN ('برونزي', 'فضي', 'ذهبي', 'ماسي') 
   OR name_en IN ('Bronze', 'Silver', 'Gold', 'Diamond');

-- التأكد من وجود جميع الفئات المطلوبة مع إدراج آمن
INSERT INTO loyalty_tiers (name, name_en, points_required, discount_percentage, special_benefits, color, icon)
SELECT * FROM (VALUES 
  ('برونزي', 'Bronze', 0, 0, '{"features": ["نقاط أساسية"]}'::jsonb, '#CD7F32', 'Award'),
  ('فضي', 'Silver', 750, 5, '{"features": ["خصم 5%", "نقاط مضاعفة"]}'::jsonb, '#C0C0C0', 'Medal'),
  ('ذهبي', 'Gold', 1500, 10, '{"features": ["خصم 10%", "شحن مجاني"]}'::jsonb, '#FFD700', 'Crown'),
  ('ماسي', 'Diamond', 3000, 15, '{"features": ["خصم 15%", "مزايا حصرية", "أولوية الدعم"]}'::jsonb, '#B9F2FF', 'Gem')
) AS v(name, name_en, points_required, discount_percentage, special_benefits, color, icon)
WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE loyalty_tiers.name = v.name);

-- تحديث مستويات العملاء الحاليين حسب النقاط الصحيحة
UPDATE customer_loyalty 
SET current_tier_id = (
  SELECT id FROM loyalty_tiers 
  WHERE points_required <= customer_loyalty.total_points
  ORDER BY points_required DESC
  LIMIT 1
),
updated_at = now();