-- إصلاح trigger إحصائيات المدن ليحسب فقط الطلبات المكتملة والمُسلّمة
CREATE OR REPLACE FUNCTION public.update_city_stats_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  -- تحديث إحصائيات المدينة فقط عند إكمال الطلب أو تسليمه
  IF NEW.customer_city IS NOT NULL AND NEW.status IN ('completed', 'delivered') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
    
    INSERT INTO public.city_order_stats (
      city_name, month, year, total_orders, total_amount
    ) VALUES (
      NEW.customer_city, current_month, current_year, 1, NEW.final_amount
    ) ON CONFLICT (city_name, month, year) 
    DO UPDATE SET 
      total_orders = city_order_stats.total_orders + 1,
      total_amount = city_order_stats.total_amount + NEW.final_amount,
      updated_at = now();
      
  -- إذا تم إلغاء طلب مكتمل سابقاً، اطرحه من الإحصائيات  
  ELSIF NEW.customer_city IS NOT NULL AND OLD.status IN ('completed', 'delivered') AND 
        NEW.status NOT IN ('completed', 'delivered') THEN
    
    UPDATE public.city_order_stats 
    SET 
      total_orders = GREATEST(0, total_orders - 1),
      total_amount = GREATEST(0, total_amount - OLD.final_amount),
      updated_at = now()
    WHERE city_name = NEW.customer_city 
    AND month = current_month 
    AND year = current_year;
    
  END IF;
  
  RETURN NEW;
END;
$function$;