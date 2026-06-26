
-- 1) تحديث auto_detect_off_channel ليستخرج owner_user_id من المنتج الفعلي
CREATE OR REPLACE FUNCTION public.auto_detect_off_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_owner UUID;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.amount, 0) <> 0 THEN RETURN NEW; END IF;

  SELECT o.id, o.order_type, o.status, o.delivery_status, o.delivery_fee, o.created_by, o.final_amount
    INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF COALESCE(v_order.order_type,'regular') NOT IN ('regular') THEN RETURN NEW; END IF;
  IF v_order.status IN ('returned','cancelled','rejected') THEN RETURN NEW; END IF;
  IF v_order.delivery_status::text <> '4' THEN RETURN NEW; END IF;

  -- ✅ استخراج مالك المنتج الفعلي (أكبر منتج بحسب الكمية × السعر)
  SELECT p.owner_user_id INTO v_owner
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.order_id AND p.owner_user_id IS NOT NULL
  GROUP BY p.owner_user_id
  ORDER BY SUM(COALESCE(oi.quantity,1) * COALESCE(oi.unit_price, oi.total_price, 0)) DESC
  LIMIT 1;

  -- في حال لم نجد مالكاً للمنتج، نقع على owner_user_id الممرّر (مالك الفاتورة) كاحتياطي
  v_owner := COALESCE(v_owner, NEW.owner_user_id);

  INSERT INTO public.off_channel_collections (
    order_id, invoice_id, collector_user_id, owner_user_id,
    delivery_fee_absorbed, customer_paid_amount, status
  ) VALUES (
    NEW.order_id, NEW.invoice_id, v_order.created_by, v_owner,
    COALESCE(v_order.delivery_fee, 0),
    COALESCE(v_order.final_amount, 0),
    'pending_classification'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END $$;

-- 2) Backfill: تحديث owner_user_id للسجلات الموجودة من مالك المنتج الفعلي
WITH product_owners AS (
  SELECT
    occ.id AS occ_id,
    (
      SELECT p.owner_user_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = occ.order_id AND p.owner_user_id IS NOT NULL
      GROUP BY p.owner_user_id
      ORDER BY SUM(COALESCE(oi.quantity,1) * COALESCE(oi.unit_price, oi.total_price, 0)) DESC
      LIMIT 1
    ) AS real_owner
  FROM public.off_channel_collections occ
)
UPDATE public.off_channel_collections occ
SET owner_user_id = po.real_owner
FROM product_owners po
WHERE occ.id = po.occ_id
  AND po.real_owner IS NOT NULL
  AND po.real_owner <> COALESCE(occ.owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid);

-- 3) إعادة إرسال إشعارات للسجلات المعلقة (للمالك الصحيح الآن)
-- نحذف الإشعارات القديمة المرتبطة ثم نطلق التريغر بإعادة كتابة الحقل
DELETE FROM public.notifications n
WHERE n.type = 'off_channel_pending_confirmation'
  AND n.related_entity_id IN (
    SELECT id::text FROM public.off_channel_collections
    WHERE status IN ('pending_classification', 'pending_owner_confirmation')
  );

-- إعادة "لمس" السجلات لإطلاق notify trigger
UPDATE public.off_channel_collections
SET status = status
WHERE status IN ('pending_classification', 'pending_owner_confirmation')
  AND owner_user_id IS NOT NULL;
