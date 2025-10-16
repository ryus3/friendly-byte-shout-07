-- المرحلة 1: تصحيح بيانات الطلب 107647475
UPDATE orders SET
  total_amount = 12000,       -- سعر المنتجات بعد الخصم
  sales_amount = 12000,       -- = total_amount دائماً
  discount = 3000,            -- الخصم الفعلي
  price_change_type = 'discount',
  final_amount = 20000,       -- السعر الأصلي الكامل (ثابت)
  delivery_fee = 5000,        -- رسوم التوصيل
  updated_at = now()
WHERE tracking_number = '107647475';

-- المرحلة 2: إضافة Validation Function
CREATE OR REPLACE FUNCTION validate_order_financial_logic()
RETURNS TRIGGER AS $$
BEGIN
  -- التحقق من أن sales_amount = total_amount
  IF NEW.sales_amount IS DISTINCT FROM NEW.total_amount THEN
    RAISE EXCEPTION 'sales_amount (%) يجب أن يساوي total_amount (%)', 
      NEW.sales_amount, NEW.total_amount;
  END IF;
  
  -- التحقق من أن final_amount >= total_amount + delivery_fee
  IF NEW.final_amount < (NEW.total_amount + COALESCE(NEW.delivery_fee, 0)) THEN
    RAISE WARNING 'final_amount (%) أقل من total_amount (%) + delivery_fee (%)',
      NEW.final_amount, NEW.total_amount, COALESCE(NEW.delivery_fee, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- المرحلة 3: إضافة Trigger
DROP TRIGGER IF EXISTS validate_order_finances ON orders;
CREATE TRIGGER validate_order_finances
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_financial_logic();