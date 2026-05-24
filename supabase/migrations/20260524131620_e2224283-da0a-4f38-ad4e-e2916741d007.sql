
-- 1) إعادة تعليم الفواتير الناقصة كي تُعاد مزامنة طلباتها بالكامل (مع الإثراء الجديد)
UPDATE public.delivery_invoices di
SET orders_last_synced_at = NULL
WHERE orders_count > 0
  AND (
    SELECT COUNT(*) FROM public.delivery_invoice_orders dio WHERE dio.invoice_id = di.id
  ) < orders_count;

-- 2) دالة إرسال إشعار إيراد لمالك المنتج عند تأكيد استلام الفاتورة (مرة واحدة لكل order/owner)
CREATE OR REPLACE FUNCTION public.notify_product_owner_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_owner_amount numeric;
  v_already boolean;
BEGIN
  -- فقط عند الانتقال إلى receipt_received = true
  IF NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RETURN NEW;
  END IF;

  -- لكل مالك منتج فريد ضمن هذا الطلب، احسب حصته الفعلية وأرسل إشعار إيراد مرة واحدة
  FOR v_owner, v_owner_amount IN
    SELECT p.owner_user_id,
           SUM(COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0))
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND p.owner_user_id IS NOT NULL
    GROUP BY p.owner_user_id
  LOOP
    -- منع التكرار: تحقق ما إذا أُرسل إشعار إيراد لهذا الطلب وهذا المالك مسبقاً
    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_owner
        AND n.type = 'revenue_received'
        AND (n.data->>'order_id') = NEW.id::text
    ) INTO v_already;

    IF NOT v_already THEN
      INSERT INTO public.notifications (user_id, type, title, message, data, priority)
      VALUES (
        v_owner,
        'revenue_received',
        '💵 إيراد جديد مستلَم',
        'تم استلام فاتورة الطلب ' || COALESCE(NEW.tracking_number, NEW.order_number, '') ||
        ' — إيرادك: ' || COALESCE(v_owner_amount, 0)::bigint::text || ' د.ع',
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', NEW.tracking_number,
          'invoice_id', NEW.delivery_partner_invoice_id,
          'owner_amount', v_owner_amount,
          'final_amount', NEW.final_amount
        ),
        'normal'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_receipt ON public.orders;
CREATE TRIGGER trg_notify_owner_on_receipt
AFTER UPDATE OF receipt_received ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_product_owner_on_receipt();

-- 3) تشغيل دالة الربط الآن لمحاولة إصلاح ما يمكن إصلاحه فوراً بالبيانات الموجودة
SELECT * FROM public.link_invoice_orders_to_orders();
