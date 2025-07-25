-- إضافة trigger لتطبيق خصم المدينة العشوائي عند إنشاء طلبات جديدة
DROP TRIGGER IF EXISTS monthly_city_discount_trigger ON orders;
CREATE TRIGGER monthly_city_discount_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_monthly_city_discount_on_order();