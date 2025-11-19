-- ✅ اختبار الطلبين 112168362 و 112066293 بعد إصلاح COALESCE

-- اختبار الطلب 112168362
UPDATE orders
SET status = 'returned'
WHERE tracking_number = 'RYUS-112168362';

UPDATE orders
SET status = 'returned_in_stock'
WHERE tracking_number = 'RYUS-112168362';

-- اختبار الطلب 112066293
UPDATE orders
SET status = 'returned'
WHERE tracking_number = 'RYUS-112066293';

UPDATE orders
SET status = 'returned_in_stock'
WHERE tracking_number = 'RYUS-112066293';