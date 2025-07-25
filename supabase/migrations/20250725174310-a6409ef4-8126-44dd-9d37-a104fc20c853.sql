-- حذف جدول حسابات التليغرام للعملاء
DROP TABLE IF EXISTS public.customer_telegram_accounts;

-- تعديل جدول إشعارات العملاء لإزالة الحقول الخاصة بالتليغرام
ALTER TABLE public.customer_notifications_sent 
DROP COLUMN IF EXISTS telegram_message_id;

-- تعديل عمود sent_via لدعم الواتساب بدلاً من التليغرام
UPDATE public.customer_notifications_sent 
SET sent_via = 'system' 
WHERE sent_via = 'telegram' OR sent_via = 'telegram_pending';

-- تحديث الدالة لإزالة منطق التليغرام من ترقية مستوى العميل
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
    
    -- إضافة إشعار نظام للعميل (سيتم إرساله لاحقاً عبر الواتساب)
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
      'pending',
      false
    );
  END IF;
END;
$function$;