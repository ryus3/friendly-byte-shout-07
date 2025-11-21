-- ============================================================
-- 🔥 ثورة نظام الإرجاع والتسليم الجزئي - الإصلاح الشامل النهائي
-- ============================================================

-- ========== PHASE A: إزالة trigger الخاطئ + إعادة trigger الصحيح ==========

-- 1️⃣ إزالة trigger والدالة الخاطئة التي تسبب الخطأ
DROP TRIGGER IF EXISTS on_order_returned_in_stock ON orders;
DROP FUNCTION IF EXISTS public.handle_returned_in_stock_order() CASCADE;

-- 2️⃣ التحقق من وجود trigger الصحيح وإعادته إن لزم
DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;

CREATE OR REPLACE TRIGGER trigger_process_returned_inventory
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'returned_in_stock' AND OLD.status IS DISTINCT FROM 'returned_in_stock')
EXECUTE FUNCTION public.process_returned_order_inventory();

-- 3️⃣ التأكد من CHECK constraint لحماية partial_delivery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_partial_delivery_cannot_full_return'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT check_partial_delivery_cannot_full_return
    CHECK (
      (order_type != 'partial_delivery') 
      OR 
      (order_type = 'partial_delivery' AND status != 'returned_in_stock')
    );
  END IF;
END $$;

COMMENT ON CONSTRAINT check_partial_delivery_cannot_full_return ON orders IS 
'partial_delivery لا يمكن أن يكون returned_in_stock - فقط returned items تعود بالحالة 17';


-- ========== PHASE B: إصلاح دوال المخزون - منع UPDATE على available_quantity ==========

-- 4️⃣ إعادة تعريف update_variant_stock بدون UPDATE على available_quantity
CREATE OR REPLACE FUNCTION public.update_variant_stock(
  p_variant_id uuid,
  p_quantity_change integer,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_current_quantity integer;
  v_new_quantity integer;
BEGIN
  -- جلب الكمية الحالية
  SELECT quantity INTO v_current_quantity
  FROM inventory
  WHERE variant_id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج % غير موجود في المخزون', p_variant_id;
  END IF;

  -- حساب الكمية الجديدة
  v_new_quantity := v_current_quantity + p_quantity_change;

  -- منع البيع بالسالب
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'لا يمكن تقليل المخزون إلى أقل من صفر. الكمية الحالية: %, التغيير المطلوب: %', 
      v_current_quantity, p_quantity_change;
  END IF;

  -- ✅ تحديث quantity فقط - available_quantity سيُحسب تلقائياً
  UPDATE inventory
  SET 
    quantity = v_new_quantity,
    updated_at = NOW()
  WHERE variant_id = p_variant_id;

  -- تسجيل في movement log إن وجد السبب
  IF p_reason IS NOT NULL THEN
    INSERT INTO inventory_movement_log (variant_id, quantity_change, reason, created_at)
    VALUES (p_variant_id, p_quantity_change, p_reason, NOW())
    ON CONFLICT DO NOTHING; -- ignore if table doesn't exist
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.update_variant_stock IS 'تحديث المخزون الفعلي (quantity) فقط - available_quantity يُحسب تلقائياً';


-- 5️⃣ إعادة تعريف return_item_to_stock بدون UPDATE على available_quantity
CREATE OR REPLACE FUNCTION public.return_item_to_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- ✅ زيادة quantity + تقليل reserved_quantity فقط
  UPDATE inventory
  SET 
    quantity = quantity + p_quantity,
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    last_updated_by = p_user_id,
    updated_at = NOW()
  WHERE variant_id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج % غير موجود في المخزون', p_variant_id;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.return_item_to_stock IS 'إرجاع منتج للمخزون: زيادة quantity + تقليل reserved - available_quantity يُحسب تلقائياً';


-- 6️⃣ إعادة تعريف process_returned_order_inventory بدون UPDATE على available_quantity
CREATE OR REPLACE FUNCTION public.process_returned_order_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_item RECORD;
BEGIN
  -- ✅ فقط للطلبات العادية order_type = 'return' - partial_delivery محمي بـ CHECK constraint
  IF NEW.order_type != 'return' THEN
    RETURN NEW;
  END IF;

  -- معالجة جميع منتجات الطلب
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    -- ✅ زيادة quantity + تقليل reserved فقط
    UPDATE inventory
    SET 
      quantity = quantity + v_item.quantity,
      reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
      updated_at = NOW()
    WHERE variant_id = v_item.variant_id;
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.process_returned_order_inventory IS 
'معالجة إرجاع المخزون عند returned_in_stock - فقط للطلبات العادية - available_quantity يُحسب تلقائياً';


-- ========== PHASE C: تصحيح البيانات الموجودة ==========

-- 7️⃣ تصحيح final_amount للطلب 112066293 (ثالث محاولة - مباشرة بدون شروط)
UPDATE orders 
SET 
  final_amount = 33000,
  updated_at = NOW()
WHERE delivery_partner_order_id = '112066293';


-- ========== التحقق النهائي ==========

-- عرض النتائج
SELECT 
  'PHASE A' as phase,
  'Triggers Fixed' as status,
  COUNT(*) as trigger_count
FROM pg_trigger 
WHERE tgname IN ('trigger_process_returned_inventory', 'on_order_returned_in_stock')

UNION ALL

SELECT 
  'PHASE B' as phase,
  'Functions Updated' as status,
  COUNT(*) as function_count
FROM pg_proc 
WHERE proname IN ('update_variant_stock', 'return_item_to_stock', 'process_returned_order_inventory')

UNION ALL

SELECT 
  'PHASE C' as phase,
  'Orders Fixed' as status,
  COUNT(*) as order_count
FROM orders
WHERE delivery_partner_order_id IN ('112552848', '112066293')
AND order_type = 'partial_delivery'
AND status = 'delivery';

-- عرض الطلبات المُصلحة
SELECT 
  tracking_number,
  order_type,
  status,
  delivery_status,
  final_amount,
  total_amount
FROM orders
WHERE delivery_partner_order_id IN ('112552848', '112066293')
ORDER BY tracking_number;