-- ============================================
-- الخطوة 1 + 2 + 6: إصلاح نظام التسليم الجزئي الشامل (مصحح)
-- ============================================

-- 1️⃣ تثبيت partial_delivery كـ order_type صحيح
-- تحديث جميع الطلبات التي لها سجل في partial_delivery_history
UPDATE public.orders o
SET order_type = 'partial_delivery',
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.partial_delivery_history pdh
  WHERE pdh.order_id = o.id
)
AND o.order_type != 'partial_delivery';

-- 2️⃣ تصحيح بيانات الطلبين 112066293 و 112552848
-- الطلب 112066293: تسليم جزئي مع منتج واحد مباع + واحد pending_return
UPDATE public.orders
SET 
  status = 'delivery',  -- الحالة الصحيحة من المزامنة
  order_type = 'partial_delivery',
  updated_at = now()
WHERE tracking_number = 'RYUS-112066293'
  AND (status != 'delivery' OR order_type != 'partial_delivery');

-- الطلب 112552848: تسليم جزئي مع 2 مباع + واحد pending_return
UPDATE public.orders
SET 
  status = 'delivery',
  order_type = 'partial_delivery',
  updated_at = now()
WHERE tracking_number = 'RYUS-112552848'
  AND (status != 'delivery' OR order_type != 'partial_delivery');

-- 3️⃣ تصحيح order_items للطلبين - التأكد من item_status الصحيح (بدون updated_at)
-- للطلب 112066293
UPDATE public.order_items oi
SET item_status = CASE
  WHEN oi.item_status = 'delivered' THEN 'delivered'  -- المباع يبقى مباع
  WHEN oi.item_status IN ('pending_return', 'returned_in_stock') THEN 'pending_return'  -- المرتجع يبقى pending حتى الحالة 17
  ELSE 'pending_return'
END
WHERE order_id = (SELECT id FROM public.orders WHERE tracking_number = 'RYUS-112066293');

-- للطلب 112552848
UPDATE public.order_items oi
SET item_status = CASE
  WHEN oi.item_status = 'delivered' THEN 'delivered'
  WHEN oi.item_status IN ('pending_return', 'returned_in_stock') THEN 'pending_return'
  ELSE 'pending_return'
END
WHERE order_id = (SELECT id FROM public.orders WHERE tracking_number = 'RYUS-112552848');

-- 6️⃣ حماية partial_delivery من التريغر handle_returned_in_stock_order
-- تعديل التريغر ليتجاهل طلبات partial_delivery
CREATE OR REPLACE FUNCTION public.handle_returned_in_stock_order()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ حماية partial_delivery من مسار الإرجاع الكامل
  IF NEW.order_type = 'partial_delivery' THEN
    RETURN NEW;  -- لا نعالج partial_delivery هنا أبداً
  END IF;

  -- معالجة الإرجاع الكامل للطلبات العادية فقط
  IF NEW.status = 'returned_in_stock' 
     AND OLD.status IN ('cancelled', 'returned', 'delivery', 'shipped', 'pending')
     AND NEW.order_type IN ('return', 'regular') THEN
    
    -- استدعاء الدالة الموجودة لمعالجة الإرجاع الكامل
    PERFORM public.process_returned_order_inventory(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ التأكد من وجود التريغر
DROP TRIGGER IF EXISTS on_order_returned_in_stock ON public.orders;
CREATE TRIGGER on_order_returned_in_stock
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'returned_in_stock' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_returned_in_stock_order();

-- 7️⃣ إضافة CHECK لضمان عدم استخدام status='returned_in_stock' مع partial_delivery
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_partial_delivery_no_full_return;
ALTER TABLE public.orders ADD CONSTRAINT check_partial_delivery_no_full_return
  CHECK (
    order_type != 'partial_delivery' OR status != 'returned_in_stock'
  );

COMMENT ON CONSTRAINT check_partial_delivery_no_full_return ON public.orders IS 
  'طلبات partial_delivery لا يمكن أن تكون returned_in_stock (إرجاع كامل) - فقط معالجة جزئية للمنتجات';
