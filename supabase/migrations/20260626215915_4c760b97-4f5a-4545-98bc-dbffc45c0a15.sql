
-- 1) تعطيل الإنشاء التلقائي لـ off_channel_collections
CREATE OR REPLACE FUNCTION public.auto_detect_off_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- مُعطَّل: السجل يُنشأ يدوياً فقط عبر نافذة التصنيف.
  RETURN NEW;
END $$;

-- 2) حذف السجلات الوهمية بانتظار التصنيف
DELETE FROM public.notifications
WHERE type = 'off_channel_pending_confirmation'
  AND related_entity_id IN (
    SELECT id::text FROM public.off_channel_collections WHERE status = 'pending_classification'
  );

DELETE FROM public.off_channel_collections WHERE status = 'pending_classification';

-- 3) إعادة إرسال الإشعار للمالك لكل سجل بحالة pending_owner_confirmation بدون إشعار
INSERT INTO public.notifications (
  user_id, title, message, type, priority, data, related_entity_id, auto_delete
)
SELECT
  occ.owner_user_id,
  'تأكيد استلام تحصيل خارج القناة',
  'الطلب ' || COALESCE(o.tracking_number, o.order_number, '—') ||
    ' بمبلغ ' || COALESCE(NULLIF(occ.owner_due_amount,0), occ.customer_paid_amount, 0)::text || ' د.ع — افتح لتأكيد الاستلام',
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
  AND occ.status = 'pending_owner_confirmation'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.type = 'off_channel_pending_confirmation'
      AND n.related_entity_id = occ.id::text
  );
