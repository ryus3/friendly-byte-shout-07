-- إصلاح سجل الربح للطلب 116266990
UPDATE profits 
SET 
  employee_profit = 7000,
  profit_amount = total_revenue - total_cost - 7000,
  updated_at = NOW()
WHERE order_id = '8d7c884d-69a3-463b-8bb5-b661a308d931';

-- تحديث سجل التسليم الجزئي
UPDATE partial_delivery_history 
SET employee_profit = 7000
WHERE order_id = '8d7c884d-69a3-463b-8bb5-b661a308d931';

-- إرسال إشعار صحيح للموظف بالربح
INSERT INTO notifications (user_id, type, title, message, data, created_at)
SELECT 
  o.created_by,
  'partial_delivery_profit',
  'تصحيح ربح التسليم الجزئي',
  'تم تصحيح ربحك من التسليم الجزئي للطلب 116266990: ربحك 7,000 د.ع (معلق حتى استلام الفاتورة)',
  jsonb_build_object(
    'order_id', o.id,
    'tracking_number', o.tracking_number,
    'employee_profit', 7000,
    'status', 'pending'
  ),
  NOW()
FROM orders o
WHERE o.id = '8d7c884d-69a3-463b-8bb5-b661a308d931';