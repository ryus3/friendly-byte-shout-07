-- ربط المنتجات بالتصنيفات الصحيحة

-- ربط "برشلونة" و "ارجنتين" بتصنيف "رجالي"
UPDATE products 
SET category_id = 'ec70b29b-4cbf-4929-8080-48ac6a08a280',
    updated_at = now()
WHERE name IN ('برشلونة', 'ارجنتين');

-- ربط "سوت شيك" و "سوت مايسترو" بتصنيف "نسائي"
UPDATE products 
SET category_id = '6d356c17-c757-48ea-adc8-6f604fe1e736',
    updated_at = now()
WHERE name IN ('سوت شيك', 'سوت مايسترو');