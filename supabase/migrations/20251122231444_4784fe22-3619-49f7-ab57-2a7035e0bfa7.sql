-- ========================================
-- 🔥 الثورة الكاملة لنظام التسليم الجزئي
-- ========================================
-- الهدف: التسليم الجزئي ≠ خصم!
-- discount = 0 دائماً للتسليم الجزئي
-- ========================================

-- 1️⃣ حذف الـ trigger الخاطئ الموجود
DROP TRIGGER IF EXISTS after_partial_delivery_history_change ON partial_delivery_history;
DROP FUNCTION IF EXISTS sync_partial_delivery_final_amount();

-- 2️⃣ إنشاء trigger صحيح 100%
CREATE OR REPLACE FUNCTION sync_partial_delivery_final_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ تحديث فقط: final_amount (من delivered_revenue) + discount = 0
  UPDATE orders
  SET 
    final_amount = NEW.delivered_revenue,  -- السعر النهائي الصحيح
    discount = 0,                          -- لا خصم للتسليم الجزئي!
    updated_at = NOW()
  WHERE id = NEW.order_id
    AND order_type = 'partial_delivery';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_partial_delivery_history_change
AFTER INSERT OR UPDATE OF delivered_revenue ON partial_delivery_history
FOR EACH ROW
EXECUTE FUNCTION sync_partial_delivery_final_amount();

-- 3️⃣ تصحيح جميع الطلبات الجزئية الموجودة
UPDATE orders o
SET 
  final_amount = p.delivered_revenue,    -- من partial_delivery_history
  discount = 0,                          -- تصفير الخصم الخاطئ
  total_amount = p.delivered_revenue - COALESCE(p.delivery_fee_allocated, o.delivery_fee, 0),
  updated_at = NOW()
FROM partial_delivery_history p
WHERE p.order_id = o.id
  AND o.order_type = 'partial_delivery'
  AND (
    o.final_amount IS DISTINCT FROM p.delivered_revenue
    OR o.discount != 0
  );

-- 4️⃣ تقرير التحقق النهائي
DO $$
DECLARE
  v_total_partial_orders INTEGER;
  v_wrong_final_amount_count INTEGER;
  v_wrong_discount_count INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN final_amount != 33000 THEN 1 END),
    COUNT(CASE WHEN discount != 0 THEN 1 END)
  INTO v_total_partial_orders, v_wrong_final_amount_count, v_wrong_discount_count
  FROM orders
  WHERE order_type = 'partial_delivery';
  
  RAISE NOTICE '✅ إجمالي طلبات التسليم الجزئي: %', v_total_partial_orders;
  RAISE NOTICE '❌ طلبات بـ final_amount خاطئ: %', v_wrong_final_amount_count;
  RAISE NOTICE '❌ طلبات بـ discount خاطئ: %', v_wrong_discount_count;
END $$;

-- 5️⃣ فحص الطلب 112066293 بالتحديد
DO $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    tracking_number,
    total_amount,
    final_amount,
    discount,
    delivery_fee,
    (SELECT delivered_revenue FROM partial_delivery_history WHERE order_id = orders.id LIMIT 1) as delivered_revenue_from_history
  INTO v_order
  FROM orders
  WHERE tracking_number = '112066293';
  
  RAISE NOTICE '📦 الطلب 112066293:';
  RAISE NOTICE '  - total_amount: %', v_order.total_amount;
  RAISE NOTICE '  - final_amount: %', v_order.final_amount;
  RAISE NOTICE '  - discount: %', v_order.discount;
  RAISE NOTICE '  - delivery_fee: %', v_order.delivery_fee;
  RAISE NOTICE '  - delivered_revenue (history): %', v_order.delivered_revenue_from_history;
  
  IF v_order.final_amount = 33000 AND v_order.discount = 0 THEN
    RAISE NOTICE '✅ الطلب 112066293 صحيح 100%%!';
  ELSE
    RAISE NOTICE '❌ الطلب 112066293 لا يزال بحاجة لتصحيح!';
  END IF;
END $$;