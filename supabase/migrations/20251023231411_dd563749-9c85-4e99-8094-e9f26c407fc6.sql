-- تنظيف البيانات: تحويل delivery_status من نص إلى رقم لطلبات AlWaseet
UPDATE orders
SET delivery_status = '23'
WHERE delivery_partner = 'alwaseet'
  AND delivery_status = 'ارسال الى مخزن الارجاعات';