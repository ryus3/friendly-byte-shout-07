-- تعطيل trigger الخاطئ الذي لا ينقص quantity
-- هذا للتجربة فقط - يمكن إعادة تفعيله لاحقاً
ALTER TABLE orders DISABLE TRIGGER trg_update_sold_on_delivery;

-- تعليق: Trigger الصحيح هو handle_order_status_change الذي ينفذ:
-- quantity--, reserved_quantity--, sold_quantity++
-- بينما trg_update_sold_on_delivery كان ينفذ فقط:
-- reserved_quantity--, sold_quantity++ (بدون تقليل quantity)