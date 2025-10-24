-- إضافة عمود item_direction لجدول order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS item_direction TEXT;

-- إضافة constraint للتحقق من القيم الصحيحة
ALTER TABLE order_items
ADD CONSTRAINT valid_item_direction 
CHECK (item_direction IN ('outgoing', 'incoming') OR item_direction IS NULL);

-- إضافة index للأداء
CREATE INDEX IF NOT EXISTS idx_order_items_direction 
ON order_items(item_direction) 
WHERE item_direction IS NOT NULL;

-- تعليق توضيحي
COMMENT ON COLUMN order_items.item_direction IS 'اتجاه المنتج في طلبات الاستبدال: outgoing (صادر للزبون) أو incoming (وارد من الزبون)';