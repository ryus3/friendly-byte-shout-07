-- تعديل دالة حساب نقاط الولاء لتعطي 250 نقطة لكل طلب مكتمل
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points_per_order()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 250 نقطة لكل طلب مكتمل
  RETURN 250;
END;
$function$;

-- تحديث trigger لاستخدام النقاط الثابتة للطلب بدلاً من النسبة من المبلغ
CREATE OR REPLACE FUNCTION public.handle_order_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_points_to_add INTEGER;
  current_loyalty_record RECORD;
BEGIN
  -- فقط للطلبات المكتملة والمستلمة
  IF NEW.status = 'completed' AND NEW.receipt_received = true 
     AND OLD.status != 'completed' AND OLD.receipt_received != true THEN
    
    -- حساب النقاط الثابتة للطلب (250 نقطة)
    customer_points_to_add := calculate_loyalty_points_per_order();
    
    -- الحصول على سجل الولاء الحالي
    SELECT * INTO current_loyalty_record 
    FROM customer_loyalty 
    WHERE customer_id = NEW.customer_id;
    
    -- إذا لم يوجد سجل ولاء، إنشاء واحد جديد
    IF current_loyalty_record IS NULL THEN
      INSERT INTO customer_loyalty (
        customer_id,
        total_points,
        total_spent,
        total_orders,
        points_expiry_date
      ) VALUES (
        NEW.customer_id,
        customer_points_to_add,
        NEW.total_amount,
        1,
        now() + INTERVAL '3 months'
      );
    ELSE
      -- تحديث السجل الموجود
      UPDATE customer_loyalty 
      SET 
        total_points = total_points + customer_points_to_add,
        total_spent = total_spent + NEW.total_amount,
        total_orders = total_orders + 1,
        points_expiry_date = now() + INTERVAL '3 months',
        updated_at = now()
      WHERE customer_id = NEW.customer_id;
    END IF;
    
    -- تسجيل تاريخ النقاط
    INSERT INTO loyalty_points_history (
      customer_id,
      order_id,
      points_earned,
      transaction_type,
      description
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      customer_points_to_add,
      'earned',
      'نقاط من طلب مكتمل - 250 نقطة ثابتة'
    );
    
    -- تحديث مستوى العميل
    PERFORM update_customer_tier(NEW.customer_id);
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء أو استبدال trigger للطلبات
DROP TRIGGER IF EXISTS order_loyalty_points_trigger ON orders;
CREATE TRIGGER order_loyalty_points_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_loyalty_points();