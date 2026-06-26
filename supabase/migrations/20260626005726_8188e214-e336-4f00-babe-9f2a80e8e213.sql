
-- ============================================================
-- 1) حماية order_type على مستوى DB من التحويل القسري
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_order_type_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  protected_types text[] := ARRAY['return','exchange','replacement'];
BEGIN
  -- إذا كان النوع الأصلي محمي ويحاول تغييره إلى نوع آخر (إلا للمدير العام عبر تحديث صريح)
  IF OLD.order_type = ANY(protected_types) 
     AND NEW.order_type IS DISTINCT FROM OLD.order_type 
     AND NEW.order_type <> OLD.order_type
  THEN
    -- السماح فقط بالتحويل من return ↔ exchange ↔ replacement (تصحيحات يدوية)
    IF NOT (NEW.order_type = ANY(protected_types)) THEN
      RAISE NOTICE 'محاولة تغيير order_type من % إلى % رُفضت للطلب %', 
        OLD.order_type, NEW.order_type, COALESCE(NEW.tracking_number, NEW.id::text);
      NEW.order_type := OLD.order_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_type ON public.orders;
CREATE TRIGGER trg_protect_order_type
  BEFORE UPDATE OF order_type ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_type_immutability();

-- ============================================================
-- 2) أرشفة تلقائية للطلبات المرتجعة كلياً وطلبات الإرجاع
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_archive_returned_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- شرط الأرشفة التلقائية: 
  --   (1) delivery_status = '17' (مرتجع للتاجر)
  --   (2) receipt_received = true (تأكيد استلام الفاتورة)
  --   (3) الطلب ليس مؤرشفاً بعد
  IF NEW.delivery_status = '17'
     AND COALESCE(NEW.receipt_received, false) = true
     AND COALESCE(NEW.isarchived, false) = false
  THEN
    NEW.isarchived := true;
    
    -- تصفير ربح الموظف لأن الطلب مرتجع بالكامل (لا يوجد مباع)
    UPDATE public.profits 
    SET status = 'settled',
        employee_profit = 0,
        settled_at = COALESCE(settled_at, now()),
        updated_at = now()
    WHERE order_id = NEW.id 
      AND status IN ('pending','invoice_received')
      AND NEW.status = 'returned'; -- مرتجع كلياً فقط
    
    RAISE NOTICE 'تم أرشفة الطلب % تلقائياً (مرتجع للتاجر)', 
      COALESCE(NEW.tracking_number, NEW.id::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_archive_returned_orders ON public.orders;
CREATE TRIGGER trg_auto_archive_returned_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.delivery_status = '17' OR NEW.receipt_received = true)
  EXECUTE FUNCTION public.auto_archive_returned_orders();
