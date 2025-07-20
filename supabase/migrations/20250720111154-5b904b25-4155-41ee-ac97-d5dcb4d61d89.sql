-- إصلاح دالة توليد رقم الطلب لتعمل كـ trigger
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة تفعيل النظام المالي الكامل مع جميع التريجرز

-- 1. إعادة تفعيل trigger حساب الأرباح عند استلام الفاتورة
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt ON public.orders;
CREATE TRIGGER trigger_calculate_profit_on_receipt
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.receipt_received IS DISTINCT FROM NEW.receipt_received AND NEW.receipt_received = true)
  EXECUTE FUNCTION public.trigger_calculate_profit_on_receipt();

-- 2. إعادة تفعيل trigger تدفق النقد للطلبات
DROP TRIGGER IF EXISTS handle_order_cash_flow_trigger ON public.orders;
CREATE TRIGGER handle_order_cash_flow_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_cash_flow();

-- 3. إعادة تفعيل trigger تدفق النقد للمشتريات  
DROP TRIGGER IF EXISTS handle_purchase_cash_flow_trigger ON public.purchases;
CREATE TRIGGER handle_purchase_cash_flow_trigger
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_cash_flow();

-- 4. إعادة تفعيل trigger معالجة المصاريف
DROP TRIGGER IF EXISTS process_expense_cash_movement_trigger ON public.expenses;
CREATE TRIGGER process_expense_cash_movement_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.process_expense_cash_movement();

-- 5. إعادة تفعيل trigger توليد رقم الطلب
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- 6. إعادة تفعيل trigger توليد رقم المشتريات
DROP TRIGGER IF EXISTS auto_generate_purchase_number_trigger ON public.purchases;
CREATE TRIGGER auto_generate_purchase_number_trigger
  BEFORE INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_purchase_number();

-- التحقق من التريجرز المفعلة
SELECT 
  trigger_name, 
  event_object_table, 
  action_timing, 
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;