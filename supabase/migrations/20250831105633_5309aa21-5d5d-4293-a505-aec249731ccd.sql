
-- 1) وظيفة إشعار حالات الوسيط: نص مطابق + tracking_number + منع تكرار منطقي
create or replace function public.notify_alwaseet_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  status_text text;
  notification_message text;
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

  -- نص الحالة مطابق لتعريفات صفحة المتابعة
  status_text := case new.delivery_status
    when '2'  then 'تم الاستلام من قبل المندوب ( تم الشحن)'
    when '3'  then 'قيد التوصيل الى الزبون (في عهدة المندوب)'
    when '4'  then 'تم التسليم للزبون'
    when '12' then 'في مخزن مرتجع المحافظة'
    when '13' then 'في مخزن مرتجع بغداد'
    when '14' then 'اعادة الارسال الى الزبون'
    when '15' then 'ارجاع الى التاجر'
    when '16' then 'قيد الارجاع الى التاجر (في عهدة المندوب)'
    when '17' then 'تم الارجاع الى التاجر'
    when '18' then 'تغيير سعر'
    when '19' then 'ارجاع بعد الاستلام'
    when '20' then 'تبديل بعد التوصيل'
    when '21' then 'تم التسليم للزبون واستلام منة الاسترجاع'
    when '25' then 'لا يرد'
    when '26' then 'لا يرد بعد الاتفاق'
    when '27' then 'مغلق'
    when '28' then 'مغلق بعد الاتفاق'
    when '29' then 'مؤجل'
    when '30' then 'مؤجل لحين اعادة الطلب لاحقا'
    when '31' then 'الغاء الطلب'
    when '32' then 'رفض الطلب'
    when '33' then 'مفصول عن الخدمة'
    when '34' then 'طلب مكرر'
    when '35' then 'مستلم مسبقا'
    when '36' then 'الرقم غير معرف'
    when '37' then 'الرقم غير داخل في الخدمة'
    when '38' then 'العنوان غير دقيق'
    when '39' then 'لم يطلب'
    when '40' then 'حظر المندوب'
    when '41' then 'لا يمكن الاتصال بالرقم'
    when '42' then 'تغيير المندوب'
    when '44' then 'اخراج من المخزن وارسالة الى الفرز'
    else 'حالة غير معروفة'
  end;

  -- رقم يعرض في النص: tracking_number إن وجد وإلا order_number وإلا id
  msg_number := coalesce(nullif(new.tracking_number, ''), nullif(new.order_number, ''), new.id::text);

  -- صياغة الرسالة النهائية: "<النص> <الرقم>"
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
        'status_text', status_text,
        'delivery_partner', new.delivery_partner
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
        'status_text', status_text,
        'delivery_partner', new.delivery_partner,
        'employee_id', new.created_by
      ),
      'medium'
    );
  end if;

  return new;
end;
$$;

-- 2) ربط/إعادة ربط التريغر الصحيح
drop trigger if exists trigger_notify_alwaseet_status_change on public.orders;
create trigger trigger_notify_alwaseet_status_change
  after update on public.orders
  for each row
  execute function public.notify_alwaseet_status_change();

-- 3) إسقاط تريغرات قديمة إن وجدت لمنع التكرار
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'notify_order_status_change') then
    execute 'drop trigger notify_order_status_change on public.orders';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'order_notifications_trigger') then
    execute 'drop trigger order_notifications_trigger on public.orders';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'unified_order_status_trigger') then
    execute 'drop trigger unified_order_status_trigger on public.orders';
  end if;
end$$;

-- 4) فهرس فريد جزئي يمنع إدراج إشعار مكرر (لكل order_id + delivery_status + نوع المستخدم)
create unique index if not exists uniq_alwaseet_notif_per_order_state_user
on public.notifications ((data->>'order_id'), (data->>'delivery_status'), coalesce(user_id::text, 'admin'))
where type = 'alwaseet_status_change';

-- 5) تنظيف الإشعارات المكررة السابقة والإبقاء على الأحدث
with ranked as (
  select id,
         row_number() over (
           partition by data->>'order_id', data->>'delivery_status', coalesce(user_id::text,'admin')
           order by created_at desc, id desc
         ) rn
  from public.notifications
  where type = 'alwaseet_status_change'
)
delete from public.notifications n
using ranked r
where n.id = r.id and r.rn > 1;
