-- تحديث دالة إشعارات الوسيط لتطبيق الصيغة الجديدة
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  existing_notification_id uuid;
  msg_number text;
  status_text text;
  notification_message text;
begin
  -- فقط لطلبات الوسيط
  if lower(coalesce(new.delivery_partner, '')) <> 'alwaseet' then
    return new;
  end if;

  -- لا ترسل إلا عند تغير حالة التوصيل فعلاً
  if old.delivery_status is not distinct from new.delivery_status then
    return new;
  end if;

  -- رقم يعرض في النص: tracking_number إن وجد وإلا order_number وإلا id
  msg_number := coalesce(nullif(new.tracking_number, ''), nullif(new.order_number, ''), new.id::text);

  -- الحصول على النص الحرفي للحالة من ALWASEET_STATUS_DEFINITIONS
  status_text := CASE new.delivery_status
    WHEN '0' THEN 'معطل او غير فعال'
    WHEN '1' THEN 'فعال ( قيد التجهير)'
    WHEN '2' THEN 'تم الاستلام من قبل المندوب ( تم الشحن)'
    WHEN '3' THEN 'قيد التوصيل الى الزبون (في عهدة المندوب)'
    WHEN '4' THEN 'تم التسليم للزبون'
    WHEN '5' THEN 'في موقع فرز بغداد'
    WHEN '6' THEN 'في مكتب'
    WHEN '7' THEN 'في الطريق الى مكتب المحافظة'
    WHEN '12' THEN 'في مخزن مرتجع المحافظة'
    WHEN '13' THEN 'في مخزن مرتجع بغداد'
    WHEN '14' THEN 'اعادة الارسال الى الزبون'
    WHEN '15' THEN 'ارجاع الى التاجر'
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

  -- تطبيق الصيغة الجديدة: النص الحرفي + رقم التتبع
  notification_message := status_text || ' ' || msg_number;

  -- منع التكرار المنطقي: نفس الطلب + نفس الحالة + نفس المستلم
  select id into existing_notification_id
  from public.notifications 
  where type = 'alwaseet_status_change'
    and (data->>'order_id')::uuid = new.id
    and (data->>'delivery_status') = new.delivery_status
    and coalesce(user_id::text, 'admin') = coalesce(new.created_by::text, 'admin')
  limit 1;

  if existing_notification_id is null then
    -- إشعار لصاحب الطلب (الموظف)
    insert into public.notifications (type, title, message, user_id, data, priority)
    values (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      notification_message,
      new.created_by,
      jsonb_build_object(
        'order_id', new.id,
        'order_number', new.order_number,
        'tracking_number', new.tracking_number,
        'delivery_status', new.delivery_status,
        'state_id', new.delivery_status,
        'delivery_partner', new.delivery_partner,
        'customer_name', new.customer_name,
        'customer_phone', new.customer_phone
      ),
      'medium'
    );
  end if;

  -- إشعار عام للمديرين (user_id null) مع منع التكرار لنفس المجموعة
  select id into existing_notification_id
  from public.notifications 
  where type = 'alwaseet_status_change'
    and (data->>'order_id')::uuid = new.id
    and (data->>'delivery_status') = new.delivery_status
    and user_id is null
  limit 1;

  if existing_notification_id is null then
    insert into public.notifications (type, title, message, user_id, data, priority)
    values (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      notification_message,
      null,
      jsonb_build_object(
        'order_id', new.id,
        'order_number', new.order_number,
        'tracking_number', new.tracking_number,
        'delivery_status', new.delivery_status,
        'state_id', new.delivery_status,
        'delivery_partner', new.delivery_partner,
        'customer_name', new.customer_name,
        'customer_phone', new.customer_phone,
        'employee_id', new.created_by
      ),
      'medium'
    );
  end if;

  return new;
end;
$function$;