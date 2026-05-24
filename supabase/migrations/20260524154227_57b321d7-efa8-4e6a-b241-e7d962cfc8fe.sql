CREATE OR REPLACE FUNCTION public.notify_invoice_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID := '91484496-b887-44f7-9e5d-be9db5567604';
  v_notification_type TEXT;
  v_message TEXT;
  v_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_normalized = 'pending' OR NEW.received = false THEN
      v_notification_type := 'invoice_pending';
      v_message := 'فاتورة جديدة معلقة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    ELSE
      v_notification_type := 'invoice_received';
      v_message := 'فاتورة مستلمة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status_normalized IS DISTINCT FROM 'received' AND NEW.status_normalized = 'received')
       OR (OLD.received IS DISTINCT FROM true AND NEW.received = true) THEN
      v_notification_type := 'invoice_received';
      v_message := 'تم استلام الفاتورة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'invoice_id', NEW.id,
    'external_id', NEW.external_id,
    'amount', NEW.amount,
    'status', NEW.status,
    'status_normalized', NEW.status_normalized,
    'owner_user_id', NEW.owner_user_id
  );

  -- ✅ توجيه الإشعار حصراً لمالك الفاتورة (مالك المنتج). Fallback للمدير فقط عند غياب المالك.
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO invoice_notifications (invoice_id, user_id, notification_type, message, data)
    VALUES (NEW.id, NEW.owner_user_id, v_notification_type, v_message, v_data)
    ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
  ELSE
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO invoice_notifications (invoice_id, user_id, notification_type, message, data)
      VALUES (NEW.id, v_admin_id, v_notification_type, v_message, v_data)
      ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create invoice notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;