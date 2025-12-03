-- تصحيح مخزون الإيطالي الأبيض L (variant_id: 63dc7e67-80a1-452c-845f-d3696493b0eb)
-- التسليم الجزئي للطلب 115458722 لم يُحدّث المخزون بشكل صحيح
UPDATE inventory
SET 
  quantity = GREATEST(0, quantity - 1),           -- من 23 إلى 22
  sold_quantity = COALESCE(sold_quantity, 0) + 1  -- من 3 إلى 4
WHERE variant_id = '63dc7e67-80a1-452c-845f-d3696493b0eb';