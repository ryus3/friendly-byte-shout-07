-- إصلاح التحذيرات الأمنية: إضافة search_path للـ validation function
DROP FUNCTION IF EXISTS validate_order_financial_logic() CASCADE;

CREATE OR REPLACE FUNCTION validate_order_financial_logic()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- إعادة إنشاء الـ Trigger
DROP TRIGGER IF EXISTS validate_order_finances ON orders;
CREATE TRIGGER validate_order_finances
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_financial_logic();