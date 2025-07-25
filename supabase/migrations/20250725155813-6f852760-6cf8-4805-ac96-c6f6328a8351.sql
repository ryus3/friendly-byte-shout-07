-- إضافة جدول لربط العملاء بحسابات التليغرام
CREATE TABLE public.customer_telegram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id),
  UNIQUE(telegram_chat_id)
);

-- RLS للجدول الجديد
ALTER TABLE public.customer_telegram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يديرون حسابات التليغرام للعملاء"
ON public.customer_telegram_accounts
FOR ALL
USING (auth.uid() IS NOT NULL);

-- جدول لتتبع الإشعارات المرسلة
CREATE TABLE public.customer_notifications_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  notification_type TEXT NOT NULL, -- 'order_confirmed', 'tier_upgrade', 'discount_available'
  message TEXT NOT NULL,
  sent_via TEXT NOT NULL, -- 'telegram', 'system', 'manual'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  telegram_message_id INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يديرون إشعارات العملاء"
ON public.customer_notifications_sent
FOR ALL
USING (auth.uid() IS NOT NULL);

-- جدول إحصائيات المدن للخصومات العشوائية
CREATE TABLE public.city_order_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city_name, month, year)
);

ALTER TABLE public.city_order_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يرون إحصائيات المدن"
ON public.city_order_stats
FOR ALL
USING (auth.uid() IS NOT NULL);

-- دالة لتحديث إحصائيات المدن عند إضافة طلب
CREATE OR REPLACE FUNCTION public.update_city_stats_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  -- تحديث إحصائيات المدينة
  IF NEW.customer_city IS NOT NULL AND NEW.status = 'completed' THEN
    INSERT INTO public.city_order_stats (
      city_name, month, year, total_orders, total_amount
    ) VALUES (
      NEW.customer_city, current_month, current_year, 1, NEW.final_amount
    ) ON CONFLICT (city_name, month, year) 
    DO UPDATE SET 
      total_orders = city_order_stats.total_orders + 1,
      total_amount = city_order_stats.total_amount + NEW.final_amount,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- تطبيق التريغر على جدول الطلبات
CREATE TRIGGER update_city_stats_on_order_completion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.update_city_stats_on_order();

-- دالة لاختيار مدينة عشوائية للخصم الشهري
CREATE OR REPLACE FUNCTION public.select_random_city_for_monthly_discount()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  previous_month INTEGER := CASE WHEN current_month = 1 THEN 12 ELSE current_month - 1 END;
  previous_year INTEGER := CASE WHEN current_month = 1 THEN current_year - 1 ELSE current_year END;
  selected_city RECORD;
  discount_percentage NUMERIC := 10; -- خصم 10%
BEGIN
  -- التحقق من عدم وجود مدينة مختارة لهذا الشهر
  IF EXISTS (
    SELECT 1 FROM public.city_random_discounts 
    WHERE discount_month = current_month AND discount_year = current_year
  ) THEN
    RETURN jsonb_build_object('message', 'تم اختيار مدينة لهذا الشهر مسبقاً');
  END IF;
  
  -- اختيار المدينة الأكثر طلباً من الشهر السابق عشوائياً من أفضل 5 مدن
  SELECT city_name, total_orders, total_amount
  INTO selected_city
  FROM public.city_order_stats
  WHERE month = previous_month AND year = previous_year
  AND total_orders >= 3 -- على الأقل 3 طلبات
  ORDER BY total_orders DESC, RANDOM()
  LIMIT 1;
  
  IF selected_city.city_name IS NOT NULL THEN
    -- إضافة المدينة للخصومات
    INSERT INTO public.city_random_discounts (
      city_name, discount_month, discount_year, discount_percentage
    ) VALUES (
      selected_city.city_name, current_month, current_year, discount_percentage
    );
    
    -- إضافة إشعار للمديرين
    INSERT INTO public.notifications (
      title, message, type, priority, data
    ) VALUES (
      'مدينة الخصم الشهري',
      'تم اختيار مدينة ' || selected_city.city_name || ' للحصول على خصم ' || discount_percentage || '% لهذا الشهر',
      'city_discount_selected',
      'high',
      jsonb_build_object(
        'city_name', selected_city.city_name,
        'discount_percentage', discount_percentage,
        'orders_last_month', selected_city.total_orders,
        'amount_last_month', selected_city.total_amount
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'city_name', selected_city.city_name,
      'discount_percentage', discount_percentage,
      'orders_last_month', selected_city.total_orders,
      'amount_last_month', selected_city.total_amount
    );
  ELSE
    RETURN jsonb_build_object('message', 'لا توجد مدن مؤهلة للخصم هذا الشهر');
  END IF;
END;
$function$;

-- دالة لإرسال إشعار عند ترقية مستوى العميل (تحديث الدالة الموجودة)
CREATE OR REPLACE FUNCTION public.update_customer_tier(p_customer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_points INTEGER;
  new_tier_id UUID;
  old_tier_id UUID;
  new_tier_name TEXT;
  customer_name TEXT;
  customer_telegram_chat BIGINT;
BEGIN
  -- الحصول على نقاط العميل الحالية
  SELECT total_points, current_tier_id INTO customer_points, old_tier_id
  FROM public.customer_loyalty 
  WHERE customer_id = p_customer_id;
  
  -- العثور على المستوى المناسب
  SELECT id, name INTO new_tier_id, new_tier_name
  FROM public.loyalty_tiers
  WHERE points_required <= customer_points
  ORDER BY points_required DESC
  LIMIT 1;
  
  -- تحديث المستوى إذا تغير
  IF new_tier_id != old_tier_id OR old_tier_id IS NULL THEN
    UPDATE public.customer_loyalty 
    SET current_tier_id = new_tier_id,
        last_tier_upgrade = now(),
        updated_at = now()
    WHERE customer_id = p_customer_id;
    
    -- الحصول على اسم العميل
    SELECT name INTO customer_name FROM public.customers WHERE id = p_customer_id;
    
    -- إضافة إشعار للترقية
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'ترقية مستوى العميل',
      'تم ترقية العميل ' || customer_name || ' إلى مستوى ' || new_tier_name,
      'loyalty_upgrade',
      jsonb_build_object('customer_id', p_customer_id, 'new_tier_id', new_tier_id, 'new_tier_name', new_tier_name),
      NULL
    );
    
    -- محاولة إرسال إشعار تليغرام للعميل
    SELECT telegram_chat_id INTO customer_telegram_chat
    FROM public.customer_telegram_accounts
    WHERE customer_id = p_customer_id AND is_active = true;
    
    IF customer_telegram_chat IS NOT NULL THEN
      -- إضافة إشعار للإرسال عبر التليغرام
      INSERT INTO public.customer_notifications_sent (
        customer_id,
        notification_type,
        message,
        sent_via,
        success
      ) VALUES (
        p_customer_id,
        'tier_upgrade',
        'تهانينا! تم ترقية حسابك إلى مستوى ' || new_tier_name || ' 🎉',
        'telegram_pending',
        false -- سيتم تحديثها عند الإرسال
      );
    END IF;
  END IF;
END;
$function$;