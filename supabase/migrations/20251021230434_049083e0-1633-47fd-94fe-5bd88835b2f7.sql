-- المرحلة 1: إضافة عمود item_direction لجدول order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS item_direction TEXT CHECK (item_direction IN ('outgoing', 'incoming', NULL));

-- إضافة index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_order_items_direction ON order_items(item_direction) WHERE item_direction IS NOT NULL;

COMMENT ON COLUMN order_items.item_direction IS 'اتجاه المنتج في طلبات الاستبدال: outgoing (صادر)، incoming (وارد)، NULL (طلب عادي)';