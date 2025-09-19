-- حذف الـ trigger المتضارب مؤقتاً وإعادة إنشاؤه
DROP TRIGGER IF EXISTS handle_order_loyalty_points_trigger ON orders;
DROP FUNCTION IF EXISTS handle_order_loyalty_points();

-- إنشاء دالة محسنة لمعالجة نقاط الولاء بدون تضارب
CREATE OR REPLACE FUNCTION public.handle_order_loyalty_points_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_points_to_add INTEGER := 50;
  existing_loyalty_id UUID;
BEGIN
  -- تجنب المعالجة أثناء مزامنة الفواتير
  IF (NEW.receipt_received IS DISTINCT FROM OLD.receipt_received) THEN
    RETURN NEW;
  END IF;

  -- معالجة نقاط الولاء عند اكتمال الطلب فقط
  IF (NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed') THEN
    -- محاولة العثور على سجل ولاء موجود
    SELECT id INTO existing_loyalty_id
    FROM customer_loyalty 
    WHERE customer_id = NEW.customer_id;

    IF existing_loyalty_id IS NOT NULL THEN
      -- تحديث سجل الولاء الموجود
      UPDATE customer_loyalty 
      SET 
        total_points = total_points + customer_points_to_add,
        total_spent = total_spent + NEW.final_amount,
        total_orders = total_orders + 1,
        updated_at = now()
      WHERE id = existing_loyalty_id;
    ELSE
      -- إنشاء سجل ولاء جديد
      INSERT INTO customer_loyalty (
        customer_id, 
        total_points, 
        total_spent, 
        total_orders,
        created_at,
        updated_at
      ) VALUES (
        NEW.customer_id, 
        customer_points_to_add, 
        NEW.final_amount, 
        1,
        now(),
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- إنشاء trigger جديد AFTER بدلاً من BEFORE
CREATE TRIGGER handle_order_loyalty_points_safe_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_loyalty_points_safe();