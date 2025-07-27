-- تصحيح مستويات الولاء حسب المطلوب
UPDATE public.loyalty_tiers 
SET 
  discount_percentage = 0,
  free_delivery_threshold = NULL
WHERE name = 'برونزي';

UPDATE public.loyalty_tiers 
SET 
  discount_percentage = 5,
  free_delivery_threshold = NULL
WHERE name = 'فضي';

-- التأكد من أن الذهبي والماسي لديهم المزايا الصحيحة
UPDATE public.loyalty_tiers 
SET 
  discount_percentage = 10,
  free_delivery_threshold = 0
WHERE name = 'ذهبي';

UPDATE public.loyalty_tiers 
SET 
  discount_percentage = 15,
  free_delivery_threshold = 0
WHERE name = 'ماسي';