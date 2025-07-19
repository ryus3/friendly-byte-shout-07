-- إنشاء باركودات صالحة بأرقام إنجليزية فقط للمنتجات
UPDATE products 
SET barcode = 'PROD' || LPAD((RANDOM() * 999999999)::bigint::text, 9, '0')
WHERE barcode IS NULL OR barcode = '' OR barcode ~ '[^\x00-\x7F]';

-- إنشاء باركودات صالحة بأرقام إنجليزية فقط للمتغيرات
UPDATE product_variants 
SET barcode = 'VAR' || LPAD((RANDOM() * 999999999)::bigint::text, 10, '0')
WHERE barcode IS NULL OR barcode = '' OR barcode ~ '[^\x00-\x7F]';