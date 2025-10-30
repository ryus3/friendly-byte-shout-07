
-- إصلاح الكميات المحجوزة السالبة في جدول inventory
-- المشكلة: reserved_quantity = -1 لبعض المنتجات
-- الحل: إعادة حساب الحجوزات الفعلية من الطلبات النشطة

-- Step 1: تصحيح جميع القيم السالبة إلى 0 أولاً
UPDATE inventory
SET reserved_quantity = 0
WHERE reserved_quantity < 0 OR reserved_quantity IS NULL;

-- Step 2: إعادة حساب الكميات المحجوزة الفعلية من الطلبات النشطة
UPDATE inventory
SET reserved_quantity = COALESCE(
  (
    SELECT SUM(oi.quantity)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.variant_id = inventory.variant_id
      AND o.status IN ('pending', 'shipped', 'delivery')
      AND o.order_type != 'return'
      AND (oi.item_direction IS NULL OR oi.item_direction != 'incoming')
  ), 0
);

-- Step 3: التأكد من أن reserved_quantity لا تتجاوز الكمية الكلية
UPDATE inventory
SET reserved_quantity = quantity
WHERE reserved_quantity > quantity;
