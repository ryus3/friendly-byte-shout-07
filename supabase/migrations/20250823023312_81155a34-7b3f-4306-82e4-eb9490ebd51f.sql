-- تصحيح حالة استلام الفاتورة للطلب 98713588 (وجميع الطلبات المشابهة)
-- الطلبات التي تم تعليمها كمستلمة الفاتورة بدون رقم فاتورة من شركة التوصيل

UPDATE orders 
SET receipt_received = false,
    updated_at = now()
WHERE delivery_partner = 'alwaseet' 
AND receipt_received = true 
AND delivery_partner_invoice_id IS NULL
AND (
  delivery_partner_order_id IS NOT NULL 
  OR tracking_number IS NOT NULL
);

-- إضافة تعليق لتوضيح السبب
COMMENT ON COLUMN orders.receipt_received IS 'يجب أن يكون true فقط عند استلام فاتورة حقيقية من شركة التوصيل أو تسجيل استلام يدوي';