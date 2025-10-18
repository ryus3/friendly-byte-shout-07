-- تصحيح الطلب 107647475
UPDATE orders 
SET 
  total_amount = 20000,   -- السعر الكلي (15,000 + 5,000)
  sales_amount = 15000,   -- سعر المنتجات فقط
  delivery_fee = 5000,    -- رسوم التوصيل
  final_amount = 20000,   -- السعر الأصلي
  discount = 0,           -- لا يوجد خصم
  updated_at = now()
WHERE tracking_number = '107647475';

-- تحديث الأرباح للطلب 107647475
UPDATE profits
SET 
  total_revenue = 20000,
  profit_amount = (15000 - total_cost),
  employee_profit = ((15000 - total_cost) * employee_percentage / 100),
  updated_at = now()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '107647475');

-- إضافة دالة التحقق من صحة المبالغ
CREATE OR REPLACE FUNCTION validate_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- التحقق من أن total_amount >= sales_amount
  IF NEW.total_amount < NEW.sales_amount THEN
    RAISE EXCEPTION 'total_amount (%) يجب أن يكون >= sales_amount (%)', NEW.total_amount, NEW.sales_amount;
  END IF;
  
  -- التحقق من أن total_amount = sales_amount + delivery_fee (مع تحذير فقط)
  IF NEW.total_amount != (NEW.sales_amount + COALESCE(NEW.delivery_fee, 0)) THEN
    RAISE WARNING 'تحذير للطلب %: total_amount (%) لا يساوي sales_amount (%) + delivery_fee (%)', 
      COALESCE(NEW.order_number, NEW.tracking_number, NEW.id::text),
      NEW.total_amount, 
      NEW.sales_amount, 
      COALESCE(NEW.delivery_fee, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة المحفز للتحقق من المبالغ
DROP TRIGGER IF EXISTS check_order_amounts ON orders;
CREATE TRIGGER check_order_amounts
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_order_amounts();