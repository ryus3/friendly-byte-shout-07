-- إنشاء function جديد لتوليد رموز التليغرام موحدة (أول 3 أحرف + 4 أرقام/أحرف عشوائية)
CREATE OR REPLACE FUNCTION public.generate_unified_telegram_code(p_full_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  name_prefix TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
  counter INTEGER := 0;
BEGIN
  -- استخراج أول 3 أحرف من الاسم
  name_prefix := UPPER(LEFT(REGEXP_REPLACE(p_full_name, '[^A-Za-z\u0621-\u064A]', '', 'g'), 3));
  
  -- التأكد من وجود أحرف كافية
  IF LENGTH(name_prefix) < 3 THEN
    name_prefix := LPAD(name_prefix, 3, 'X');
  END IF;
  
  LOOP
    -- توليد لاحقة عشوائية (4 أحرف/أرقام)
    random_suffix := SUBSTRING(MD5(RANDOM()::text || NOW()::text), 1, 4);
    new_code := name_prefix || random_suffix;
    
    -- فحص إذا كان الرمز موجود مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM public.telegram_employee_codes 
      WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- إذا لم يكن موجود، استخدمه
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
    
    -- حماية من حلقة لا نهائية (بعد 100 محاولة)
    IF counter > 100 THEN
      -- استخدم timestamp كحل أخير
      random_suffix := EXTRACT(EPOCH FROM NOW())::bigint % 10000;
      new_code := name_prefix || LPAD(random_suffix::text, 4, '0');
      RETURN new_code;
    END IF;
  END LOOP;
END;
$function$;

-- تحديث function موافقة الموظف لتشمل إنشاء user_role و telegram_employee_code
CREATE OR REPLACE FUNCTION public.approve_employee_complete(
  p_user_id uuid,
  p_full_name text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sales_role_id uuid := '720ec508-376a-4538-9624-820cc7bdd671';
  v_full_name text;
  v_telegram_code text;
  v_existing_role_count integer;
  v_existing_telegram_count integer;
BEGIN
  -- الحصول على الاسم الكامل من profiles إذا لم يُمرر
  IF p_full_name IS NULL THEN
    SELECT full_name INTO v_full_name
    FROM public.profiles
    WHERE user_id = p_user_id;
  ELSE
    v_full_name := p_full_name;
  END IF;
  
  -- التأكد من وجود الاسم
  IF v_full_name IS NULL OR TRIM(v_full_name) = '' THEN
    v_full_name := 'موظف جديد';
  END IF;
  
  -- 1. تحديث حالة المستخدم إلى active
  UPDATE public.profiles
  SET 
    status = 'active',
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- 2. التحقق من عدم وجود دور مسبق وإضافة دور sales_employee
  SELECT COUNT(*) INTO v_existing_role_count
  FROM public.user_roles
  WHERE user_id = p_user_id AND role_id = v_sales_role_id AND is_active = true;
  
  IF v_existing_role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role_id, is_active, created_at)
    VALUES (p_user_id, v_sales_role_id, true, now());
  END IF;
  
  -- 3. التحقق من عدم وجود رمز تليغرام وإنشاؤه
  SELECT COUNT(*) INTO v_existing_telegram_count
  FROM public.telegram_employee_codes
  WHERE user_id = p_user_id;
  
  IF v_existing_telegram_count = 0 THEN
    v_telegram_code := generate_unified_telegram_code(v_full_name);
    
    INSERT INTO public.telegram_employee_codes (
      user_id, employee_code, is_active, created_at, updated_at
    ) VALUES (
      p_user_id, v_telegram_code, true, now(), now()
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'telegram_code', v_telegram_code,
    'message', 'تم تفعيل الموظف بنجاح مع دور مبيعات ورمز تليغرام'
  );
END;
$function$;

-- تحديث notify_alwaseet_status_change لإصلاح منع الإشعارات بعد الحالات النهائية
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_notification_id uuid;
  msg_number text;
  status_code text;
  status_text text;
  notification_message text;
  notification_title text;
  order_age_days integer;
  is_final_state boolean := false;
  -- الحالات المهمة فقط التي تستحق إشعارات
  allowed_statuses text[] := ARRAY[
    '3','4','14','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44'
  ];
  -- الحالات النهائية التي لا تحتاج إشعارات بعدها
  final_statuses text[] := ARRAY['4', '17'];
BEGIN
  -- فقط لطلبات الوسيط
  IF lower(coalesce(NEW.delivery_partner, '')) <> 'alwaseet' THEN
    RETURN NEW;
  END IF;

  -- لا ترسل إلا عند تغير حالة التوصيل فعلاً
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- حساب عمر الطلب بالأيام
  SELECT EXTRACT(days FROM (now() - NEW.created_at))::integer INTO order_age_days;
  
  -- منع الإشعارات للطلبات القديمة (أكثر من 7 أيام) إلا عند استلام الفاتورة
  IF order_age_days > 7 AND NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RAISE NOTICE 'تم تجاهل إشعار للطلب القديم %، العمر: % أيام', COALESCE(NEW.order_number, NEW.id::text), order_age_days;
    RETURN NEW;
  END IF;

  -- تطبيع الحالة إلى كود رقمي
  status_code := COALESCE(NULLIF(TRIM(NEW.delivery_status), ''), '');
  IF status_code !~ '^\d+$' THEN
    IF status_code ~* 'فعال|قيد\s*التجهيز' THEN
      status_code := '1';
    END IF;
  END IF;

  -- التحقق من الحالات النهائية
  is_final_state := (status_code = ANY(final_statuses));
  
  -- منع الإشعارات إذا كان الطلب في حالة نهائية مسبقاً (إلا عند استلام الفاتورة)
  IF is_final_state AND OLD.delivery_status = ANY(final_statuses) 
     AND NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RAISE NOTICE 'تم تجاهل إشعار للطلب % - حالة نهائية مسبقة: %', COALESCE(NEW.order_number, NEW.id::text), OLD.delivery_status;
    RETURN NEW;
  END IF;

  -- السماح بإرسال الإشعارات فقط للحالات المهمة المحددة
  IF status_code = '' OR NOT (status_code = ANY(allowed_statuses)) THEN
    RETURN NEW;
  END IF;

  -- رقم التتبع المعروض: أولوية لـ tracking_number ثم order_number ثم id
  msg_number := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- الحصول على النص الحرفي للحالة من تعريفات الوسيط
  status_text := CASE status_code
    WHEN '3'  THEN 'قيد التوصيل الى الزبون (في عهدة المندوب)'
    WHEN '4'  THEN 'تم التسليم للزبون'
    WHEN '14' THEN 'اعادة الارسال الى الزبون'
    WHEN '16' THEN 'قيد الارجاع الى التاجر (في عهدة المندوب)'
    WHEN '17' THEN 'تم الارجاع الى التاجر'
    WHEN '18' THEN 'تغيير سعر'
    WHEN '19' THEN 'ارجاع بعد الاستلام'
    WHEN '20' THEN 'تبديل بعد التوصيل'
    WHEN '21' THEN 'تم التسليم للزبون واستلام منة الاسترجاع'
    WHEN '22' THEN 'ارسال الى الفزر'
    WHEN '23' THEN 'ارسال الى مخزن الارجاعات'
    WHEN '24' THEN 'تم تغيير محافظة الزبون'
    WHEN '25' THEN 'لا يرد'
    WHEN '26' THEN 'لا يرد بعد الاتفاق'
    WHEN '27' THEN 'مغلق'
    WHEN '28' THEN 'مغلق بعد الاتفاق'
    WHEN '29' THEN 'مؤجل'
    WHEN '30' THEN 'مؤجل لحين اعادة الطلب لاحقا'
    WHEN '31' THEN 'الغاء الطلب'
    WHEN '32' THEN 'رفض الطلب'
    WHEN '33' THEN 'مفصول عن الخدمة'
    WHEN '34' THEN 'طلب مكرر'
    WHEN '35' THEN 'مستلم مسبقا'
    WHEN '36' THEN 'الرقم غير معرف'
    WHEN '37' THEN 'الرقم غير داخل في الخدمة'
    WHEN '38' THEN 'العنوان غير دقيق'
    WHEN '39' THEN 'لم يطلب'
    WHEN '40' THEN 'حظر المندوب'
    WHEN '41' THEN 'لا يمكن الاتصال بالرقم'
    WHEN '42' THEN 'تغيير المندوب'
    WHEN '44' THEN 'اخراج من المخزن وارسالة الى الفرز'
    ELSE 'حالة غير معروفة'
  END;

  -- صيغة الرسالة الجديدة: الحالة + رقم التتبع
  notification_message := status_text || ' ' || msg_number;

  -- صيغة العنوان الجديدة: المدينة - المنطقة
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 2)), ''),
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 1)), ''),
      'غير محدد'
    );

  -- إشعار لصاحب الطلب (الموظف) مع تحديث الإشعار القائم ليصبح غير مقروء
  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND COALESCE(user_id::text, 'admin') = COALESCE(NEW.created_by::text, 'admin')
    AND created_at >= now() - interval '7 days' -- فقط الإشعارات من آخر 7 أيام
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
    VALUES (
      'alwaseet_status_change',
      notification_title,
      notification_message,
      NEW.created_by,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone
      ),
      'medium',
      false
    );
  ELSE
    UPDATE public.notifications
    SET 
      title = notification_title,
      message = notification_message,
      data = jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone
      ),
      priority = 'medium',
      is_read = false,
      updated_at = now()
    WHERE id = existing_notification_id;
  END IF;

  -- إشعار عام للمديرين (user_id null) مع تحديث الإشعار القائم ليصبح غير مقروء
  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND user_id IS NULL
    AND created_at >= now() - interval '7 days' -- فقط الإشعارات من آخر 7 أيام
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
    VALUES (
      'alwaseet_status_change',
      notification_title,
      notification_message,
      NULL,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'employee_id', NEW.created_by
      ),
      'medium',
      false
    );
  ELSE
    UPDATE public.notifications
    SET 
      title = notification_title,
      message = notification_message,
      data = jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'employee_id', NEW.created_by
      ),
      priority = 'medium',
      is_read = false,
      updated_at = now()
    WHERE id = existing_notification_id;
  END IF;

  RETURN NEW;
END;
$function$;