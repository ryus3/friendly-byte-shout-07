-- إنشاء trigger لحساب الأرباح عند استلام الفاتورة
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt_trigger ON orders;
CREATE TRIGGER auto_calculate_profit_on_receipt_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_profit_on_receipt();

-- تطبيق استلام الفاتورة على الطلب RYUS-299923 لاختبار النظام
UPDATE public.orders 
SET 
  receipt_received = true,
  receipt_received_at = now(),
  receipt_received_by = 'b4d635c5-8540-4db2-b0c2-3cce66d8ad84'::uuid,
  updated_at = now()
WHERE order_number = 'RYUS-299923';