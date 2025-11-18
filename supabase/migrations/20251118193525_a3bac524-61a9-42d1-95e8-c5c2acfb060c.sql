
-- ============================================================
-- الخطوة 1: تصحيح حالة الطلب 112552848
-- ============================================================
-- الطلب 32b22a22-19b7-40a0-a5b9-287f6d1e06fd (tracking: 112552848)
-- كان خطأً في حالة 'returned' بينما يحتوي على عناصر مُسلّمة
-- التصحيح: تحويله إلى 'partial_delivery'

UPDATE orders
SET 
  status = 'partial_delivery',
  updated_at = now()
WHERE id = '32b22a22-19b7-40a0-a5b9-287f6d1e06fd'
  AND status = 'returned';

-- ============================================================
-- الخطوة 2: فحص وتصحيح أي طلبات أخرى مشابهة
-- ============================================================
-- البحث عن أي طلبات بحالة 'returned' لكن فيها عناصر 'delivered'
-- وتحويلها إلى 'partial_delivery'

WITH problematic_orders AS (
  SELECT DISTINCT o.id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'returned'
  GROUP BY o.id
  HAVING COUNT(*) FILTER (WHERE oi.item_status = 'delivered') > 0
)
UPDATE orders
SET 
  status = 'partial_delivery',
  updated_at = now()
FROM problematic_orders
WHERE orders.id = problematic_orders.id;

-- ============================================================
-- عرض نتائج التصحيح
-- ============================================================
DO $$
DECLARE
  corrected_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO corrected_count
  FROM orders
  WHERE status = 'partial_delivery'
    AND id IN (
      SELECT DISTINCT o.id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'partial_delivery'
      GROUP BY o.id
      HAVING COUNT(*) FILTER (WHERE oi.item_status = 'delivered') > 0
    );
  
  RAISE NOTICE 'تم تصحيح حالة الطلبات إلى partial_delivery: % طلب', corrected_count;
END $$;
