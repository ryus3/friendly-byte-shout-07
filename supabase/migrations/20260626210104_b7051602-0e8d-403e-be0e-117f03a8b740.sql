
-- Broaden trigger: notify owner on INSERT (any pending status with owner set) OR status change to pending_owner_confirmation
CREATE OR REPLACE FUNCTION public.notify_owner_off_channel_pending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tracking TEXT;
  v_amount NUMERIC;
  v_should_notify BOOLEAN := false;
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.status IN ('pending_classification', 'pending_owner_confirmation') THEN
    v_should_notify := true;
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'pending_owner_confirmation'
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_should_notify := true;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(tracking_number, order_number) INTO v_tracking FROM public.orders WHERE id = NEW.order_id;
  v_amount := COALESCE(NULLIF(NEW.owner_due_amount, 0), NEW.customer_paid_amount, 0);

  INSERT INTO public.notifications (
    user_id, title, message, type, priority, data, related_entity_id, auto_delete
  ) VALUES (
    NEW.owner_user_id,
    CASE WHEN NEW.status = 'pending_owner_confirmation'
         THEN 'تأكيد استلام تحصيل خارج القناة'
         ELSE 'تحصيل خارج القناة بانتظار التصنيف' END,
    'الطلب ' || COALESCE(v_tracking,'—') || ' بمبلغ ' || COALESCE(v_amount,0)::text || ' د.ع — افتح لتأكيد الاستلام',
    'off_channel_pending_confirmation',
    'high',
    jsonb_build_object(
      'off_channel_id', NEW.id,
      'order_id', NEW.order_id,
      'amount', v_amount,
      'status', NEW.status,
      'link', '/off-channel-inbox'
    ),
    NEW.id::text,
    false
  );
  RETURN NEW;
END $$;

-- Backfill: for every existing pending off_channel_collection that never produced
-- a notification, insert one now so the owner sees it in their inbox.
INSERT INTO public.notifications (
  user_id, title, message, type, priority, data, related_entity_id, auto_delete
)
SELECT
  occ.owner_user_id,
  'تحصيل خارج القناة بانتظار تأكيدك',
  'الطلب ' || COALESCE(o.tracking_number, o.order_number, '—') ||
    ' بمبلغ ' || COALESCE(NULLIF(occ.owner_due_amount,0), occ.customer_paid_amount, 0)::text || ' د.ع',
  'off_channel_pending_confirmation',
  'high',
  jsonb_build_object(
    'off_channel_id', occ.id,
    'order_id', occ.order_id,
    'amount', COALESCE(NULLIF(occ.owner_due_amount,0), occ.customer_paid_amount, 0),
    'status', occ.status,
    'link', '/off-channel-inbox'
  ),
  occ.id::text,
  false
FROM public.off_channel_collections occ
JOIN public.orders o ON o.id = occ.order_id
WHERE occ.owner_user_id IS NOT NULL
  AND occ.status IN ('pending_classification', 'pending_owner_confirmation')
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.type = 'off_channel_pending_confirmation'
      AND n.related_entity_id = occ.id::text
  );
