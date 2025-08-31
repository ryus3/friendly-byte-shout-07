-- تحديث وظيفة notify_alwaseet_status_change لإرسال البيانات الأساسية فقط
-- التخلص من النصوص المكررة واستخدام state_id للتوليد في frontend

CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  existing_notification_id uuid;
  msg_number text;
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

  -- منع التكرار المنطقي: نفس الطلب + نفس الحالة + نفس المستلم
  select id into existing_notification_id
  from public.notifications 
  where type = 'alwaseet_status_change'
    and (data->>'order_id')::uuid = new.id
    and (data->>'delivery_status') = new.delivery_status
    and coalesce(user_id::text, 'admin') = coalesce(new.created_by::text, 'admin')
  limit 1;

  if existing_notification_id is null then
    -- إشعار لصاحب الطلب (الموظف) - بيانات أساسية فقط
    insert into public.notifications (type, title, message, user_id, data, priority)
    values (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      'delivery_status_update', -- رسالة مؤقتة سيتم استبدالها بـ frontend
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
      'delivery_status_update', -- رسالة مؤقتة سيتم استبدالها بـ frontend
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