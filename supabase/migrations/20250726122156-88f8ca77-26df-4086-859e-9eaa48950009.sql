-- إصلاح نهائي لنظام النقاط - 200 نقطة لكل طلب بدلاً من المبلغ

-- حذف الدالة القديمة إذا كانت موجودة
DROP FUNCTION IF EXISTS public.calculate_loyalty_points(order_amount numeric);

-- إعادة إنشاء دالة حساب النقاط لتعطي 200 نقطة لكل طلب
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points_per_order()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 200 نقطة لكل طلب مكتمل
  RETURN 200;
END;
$function$;

-- تحديث trigger إضافة النقاط ليستخدم النظام الجديد
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_order_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  points_to_add INTEGER;
  order_subtotal NUMERIC;
BEGIN
  -- فقط عند استلام الفاتورة
  IF NEW.receipt_received = true AND (OLD.receipt_received = false OR OLD.receipt_received IS NULL) THEN
    
    -- حساب المبلغ الفرعي (بدون التوصيل)
    order_subtotal := NEW.final_amount - NEW.delivery_fee;
    
    -- التحقق من الحد الأدنى للمبلغ (20000 بدون التوصيل)
    IF order_subtotal >= 20000 THEN
      -- الحصول على النقاط (200 نقطة ثابتة)
      points_to_add := public.calculate_loyalty_points_per_order();
      
      -- التأكد من وجود العميل في جدول الولاء
      INSERT INTO public.customer_loyalty (customer_id, total_points, total_spent, total_orders)
      VALUES (NEW.customer_id, 0, 0, 0)
      ON CONFLICT (customer_id) DO NOTHING;
      
      -- تحديث نقاط وإحصائيات العميل
      UPDATE public.customer_loyalty 
      SET total_points = total_points + points_to_add,
          total_spent = total_spent + NEW.final_amount,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE customer_id = NEW.customer_id;
      
      -- إضافة سجل النقاط
      INSERT INTO public.loyalty_points_history (
        customer_id,
        order_id,
        points_earned,
        transaction_type,
        description
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        points_to_add,
        'earned',
        'نقاط من طلب رقم ' || NEW.order_number || ' (200 نقطة ثابتة)'
      );
      
      -- تحديث مستوى العميل
      PERFORM public.update_customer_tier(NEW.customer_id);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;