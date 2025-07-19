-- توليد باركودات للمنتجات التي لا تملك باركود
UPDATE products 
SET barcode = 'PROD-' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 8))
WHERE barcode IS NULL OR barcode = '';

-- توليد باركودات للمتغيرات التي لا تملك باركود
UPDATE product_variants 
SET barcode = 'RYUS-' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 4))
WHERE barcode IS NULL OR barcode = '';