-- إصلاح الطلبات المسلمة التي لم تُسجَّل كـ sold_recorded
UPDATE orders 
SET sold_recorded = true 
WHERE delivery_status = '4' 
  AND (sold_recorded = false OR sold_recorded IS NULL)
  AND (order_type IS NULL OR order_type != 'return');

-- إعادة حساب sold_quantity من الطلبات المسلمة الفعلية
WITH sold_stats AS (
  SELECT * FROM get_products_sold_stats()
)
UPDATE inventory i
SET sold_quantity = COALESCE(ss.total_quantity_sold, 0)
FROM sold_stats ss
WHERE i.variant_id = ss.variant_id
  AND i.sold_quantity != COALESCE(ss.total_quantity_sold, 0);