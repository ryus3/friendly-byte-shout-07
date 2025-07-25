-- إصلاح نظام النقاط ليكون 200 نقطة لكل طلب بدلاً من حساب النقاط حسب المبلغ
DROP FUNCTION IF EXISTS public.calculate_loyalty_points(order_amount numeric);

-- إنشاء دالة تطبيق الخصم العشوائي للمدن تلقائياً
CREATE OR REPLACE FUNCTION public.apply_monthly_city_discount_trigger()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- تطبيق اختيار المدينة العشوائية شهرياً
  PERFORM public.select_random_city_for_monthly_discount();
END;
$function$;

-- تحديث trigger إضافة النقاط ليعطي 200 نقطة لكل طلب مكتمل
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_order_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  points_to_add INTEGER := 200; -- 200 نقطة ثابتة لكل طلب
  order_subtotal NUMERIC;
BEGIN
  -- فقط عند استلام الفاتورة
  IF NEW.receipt_received = true AND (OLD.receipt_received = false OR OLD.receipt_received IS NULL) THEN
    
    -- حساب المبلغ الفرعي (بدون التوصيل)
    order_subtotal := NEW.final_amount - NEW.delivery_fee;
    
    -- التحقق من الحد الأدنى للمبلغ (20000 بدون التوصيل)
    IF order_subtotal >= 20000 THEN
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
        'نقاط من طلب رقم ' || NEW.order_number || ' (200 نقطة)'
      );
      
      -- تحديث مستوى العميل
      PERFORM public.update_customer_tier(NEW.customer_id);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء trigger لتطبيق الخصم العشوائي شهرياً (سيتم تشغيله عند إنشاء أول طلب في الشهر)
CREATE OR REPLACE FUNCTION public.check_monthly_city_discount_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  -- عند إنشاء طلب جديد، تحقق من تطبيق خصم المدينة الشهري
  IF NEW.status = 'pending' AND TG_OP = 'INSERT' THEN
    -- تحقق من عدم وجود مدينة مختارة لهذا الشهر
    IF NOT EXISTS (
      SELECT 1 FROM public.city_random_discounts 
      WHERE discount_month = current_month AND discount_year = current_year
    ) THEN
      -- تطبيق اختيار المدينة العشوائية
      PERFORM public.select_random_city_for_monthly_discount();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;