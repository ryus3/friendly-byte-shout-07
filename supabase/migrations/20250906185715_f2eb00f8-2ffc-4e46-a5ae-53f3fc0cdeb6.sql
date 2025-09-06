
-- 1) استبدال المنطق: توحيد معرفات طلبات الوسيط إلى قيمة قياسية واحدة
CREATE OR REPLACE FUNCTION public.auto_fix_alwaseet_order_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_partner TEXT := lower(coalesce(NEW.delivery_partner,''));
  v_tracking TEXT := NULLIF(NEW.tracking_number,'');
  v_dp_id   TEXT := NULLIF(NEW.delivery_partner_order_id,'');
  v_qr      TEXT := NULLIF(NEW.qr_id,'');
  v_canonical TEXT;
BEGIN
  -- نطبع فقط لطلبات الوسيط
  IF v_partner = 'alwaseet' THEN
    -- اختيار المعرف المعياري: تفضيل رقم وسيط رقمي 6-15 خانة إن وجد
    IF v_tracking ~ '^[0-9]{6,15}$' THEN
      v_canonical := v_tracking;
    ELSIF v_dp_id ~ '^[0-9]{6,15}$' THEN
      v_canonical := v_dp_id;
    ELSIF v_qr ~ '^[0-9]{6,15}$' THEN
      v_canonical := v_qr;
    ELSE
      -- إن لم نجد رقماً، نأخذ أول قيمة غير فارغة كحل أدنى
      v_canonical := COALESCE(v_tracking, v_dp_id, v_qr);
    END IF;

    IF v_canonical IS NOT NULL THEN
      NEW.delivery_partner_order_id := v_canonical;
      NEW.tracking_number := v_canonical;
      NEW.qr_id := v_canonical;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) تفعيل الـ Trigger على جدول الطلبات
DROP TRIGGER IF EXISTS trg_orders_auto_fix_alwaseet ON public.orders;

CREATE TRIGGER trg_orders_auto_fix_alwaseet
BEFORE INSERT OR UPDATE OF tracking_number, delivery_partner_order_id, qr_id, delivery_partner
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_fix_alwaseet_order_fields();

-- 3) تصحيح البيانات الحالية فوراً (تشغيل الـ Trigger لتوحيد الحقول)
UPDATE public.orders
SET tracking_number = tracking_number
WHERE lower(coalesce(delivery_partner,'')) = 'alwaseet'
  AND (
    delivery_partner_order_id IS NULL
    OR qr_id IS NULL
    OR delivery_partner_order_id <> tracking_number
    OR qr_id <> tracking_number
  );

-- 4) إصلاح سياسات RLS على notifications لمنع الموظفين من رؤية إشعارات المدير العامة
-- السياسات الحالية التي تُسرب الإشعارات العامة للمستخدمين (يتم إسقاطها إن وُجدت)
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;

-- الإبقاء على سياسة "Admins can manage all notifications" الموجودة مسبقاً (ALL + is_admin_or_deputy())
-- الإبقاء على "Users can view their own notifications" إن كانت موجودة

-- نضمن سياسات محددة وواضحة:
DO $$
BEGIN
  -- عرض إشعارات المستخدم نفسه فقط
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='notifications' 
      AND policyname='Users can view their own notifications'
      AND cmd='SELECT'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications
      FOR SELECT
      USING ((user_id = auth.uid()) OR is_admin_or_deputy());
  END IF;

  -- تعديل إشعارات المستخدم نفسه فقط
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='notifications' 
      AND policyname='Users can update their own notifications'
      AND cmd='UPDATE'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- حذف إشعارات المستخدم نفسه فقط
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='notifications' 
      AND policyname='Users can delete their own notifications'
      AND cmd='DELETE'
  ) THEN
    CREATE POLICY "Users can delete their own notifications"
      ON public.notifications
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;

  -- ملاحظة: توجد سياسة "Admins can manage all notifications" (ALL) تسمح للمشرفين برؤية/تعديل/حذف كل شيء
  -- إن لم تكن موجودة في مشروعكم لأي سبب، يمكن إضافتها:
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='notifications' 
      AND policyname='Admins can manage all notifications'
  ) THEN
    CREATE POLICY "Admins can manage all notifications"
      ON public.notifications
      AS PERMISSIVE
      FOR ALL
      USING (is_admin_or_deputy())
      WITH CHECK (is_admin_or_deputy());
  END IF;
END$$;
