-- إصلاح الطلبات التي تم تحديثها خطأ إلى completed
-- الطلبات الخارجية التي لها delivery_status "تم التسليم للزبون" لكن بدون مصادقة مالية
-- يجب أن تكون delivered وليس completed

UPDATE orders 
SET status = 'delivered',
    updated_at = now()
WHERE delivery_partner = 'alwaseet' 
  AND status = 'completed'
  AND delivery_status LIKE '%تم التسليم%'
  AND delivery_status NOT LIKE '%مصادقة%'
  AND receipt_received = false;

-- إضافة تعليق تفصيلي
COMMENT ON COLUMN orders.status IS 'حالة الطلب الداخلية: pending, shipped, delivery, delivered, completed, cancelled, returned, returned_in_stock';
COMMENT ON COLUMN orders.delivery_status IS 'حالة الطلب من شركة التوصيل الخارجية (النص الأصلي)';
COMMENT ON COLUMN orders.receipt_received IS 'تم استلام الفاتورة يدوياً أو من خلال المصادقة المالية من شركة التوصيل';