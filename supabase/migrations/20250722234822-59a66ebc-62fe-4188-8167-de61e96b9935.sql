-- تنظيف البيانات المكررة في المخزون
-- حذف المنتجات المكررة بنفس الباركود مع الاحتفاظ بأحدثها
WITH duplicate_variants AS (
    SELECT pv.barcode, MAX(pv.created_at) as latest_created
    FROM product_variants pv
    WHERE pv.barcode IN (
        SELECT barcode 
        FROM product_variants 
        GROUP BY barcode 
        HAVING COUNT(*) > 1
    )
    GROUP BY pv.barcode
),
variants_to_keep AS (
    SELECT pv.id
    FROM product_variants pv
    INNER JOIN duplicate_variants dv ON pv.barcode = dv.barcode AND pv.created_at = dv.latest_created
),
variants_to_delete AS (
    SELECT pv.id, pv.product_id
    FROM product_variants pv
    WHERE pv.barcode IN (SELECT barcode FROM duplicate_variants)
    AND pv.id NOT IN (SELECT id FROM variants_to_keep)
)
-- حذف المخزون للمتغيرات المكررة
DELETE FROM inventory 
WHERE variant_id IN (SELECT id FROM variants_to_delete);

-- حذف المتغيرات المكررة
WITH duplicate_variants AS (
    SELECT pv.barcode, MAX(pv.created_at) as latest_created
    FROM product_variants pv
    WHERE pv.barcode IN (
        SELECT barcode 
        FROM product_variants 
        GROUP BY barcode 
        HAVING COUNT(*) > 1
    )
    GROUP BY pv.barcode
),
variants_to_keep AS (
    SELECT pv.id
    FROM product_variants pv
    INNER JOIN duplicate_variants dv ON pv.barcode = dv.barcode AND pv.created_at = dv.latest_created
)
DELETE FROM product_variants 
WHERE barcode IN (
    SELECT barcode 
    FROM product_variants 
    GROUP BY barcode 
    HAVING COUNT(*) > 1
)
AND id NOT IN (SELECT id FROM variants_to_keep);

-- حذف المنتجات التي لا تحتوي على متغيرات
DELETE FROM products 
WHERE id NOT IN (SELECT DISTINCT product_id FROM product_variants WHERE product_id IS NOT NULL);

-- تحديث مبالغ فواتير الشراء لتعكس المبلغ الصحيح (فقط تكلفة المنتجات)
UPDATE purchases 
SET total_amount = (
    SELECT COALESCE(SUM(
        (item->>'costPrice')::numeric * (item->>'quantity')::numeric
    ), 0)
    FROM jsonb_array_elements(items) AS item
)
WHERE items IS NOT NULL 
AND jsonb_array_length(items) > 0;