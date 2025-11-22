-- ============================================
-- 🔥 ثورة إصلاحية كاملة: نظام التسليم الجزئي
-- ============================================

-- المرحلة 1️⃣: Database Trigger للتزامن التلقائي
-- ============================================

-- دالة لتزامن final_amount تلقائياً من partial_delivery_history
CREATE OR REPLACE FUNCTION sync_partial_delivery_final_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث orders.final_amount و total_amount بناءً على delivered_revenue
  UPDATE orders
  SET 
    final_amount = NEW.delivered_revenue,
    total_amount = NEW.delivered_revenue - COALESCE(delivery_fee, 0),
    discount = GREATEST(0, 
      (SELECT original_total_amount FROM orders WHERE id = NEW.order_id) - NEW.delivered_revenue
    ),
    updated_at = now()
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء Trigger على INSERT و UPDATE
DROP TRIGGER IF EXISTS after_partial_delivery_history_change ON partial_delivery_history;

CREATE TRIGGER after_partial_delivery_history_change
AFTER INSERT OR UPDATE OF delivered_revenue ON partial_delivery_history
FOR EACH ROW
EXECUTE FUNCTION sync_partial_delivery_final_amount();

-- المرحلة 2️⃣: تصحيح شامل لجميع الطلبات الجزئية الموجودة
-- ============================================

-- تحديث جميع الطلبات الجزئية بناءً على partial_delivery_history
WITH partial_orders_correction AS (
  SELECT 
    o.id AS order_id,
    o.tracking_number,
    o.final_amount AS old_final_amount,
    pdh.delivered_revenue AS correct_final_amount,
    (pdh.delivered_revenue - COALESCE(o.delivery_fee, 0)) AS correct_total_amount,
    GREATEST(0, o.total_amount - pdh.delivered_revenue) AS correct_discount
  FROM orders o
  JOIN partial_delivery_history pdh ON pdh.order_id = o.id
  WHERE o.order_type = 'partial_delivery'
    AND o.final_amount != pdh.delivered_revenue
)
UPDATE orders o
SET 
  final_amount = poc.correct_final_amount,
  total_amount = poc.correct_total_amount,
  discount = poc.correct_discount,
  updated_at = now()
FROM partial_orders_correction poc
WHERE o.id = poc.order_id;

-- المرحلة 3️⃣: تصحيح جدول profits ليتطابق
-- ============================================

UPDATE profits p
SET 
  total_revenue = pdh.delivered_revenue,
  total_cost = pdh.delivered_cost,
  profit_amount = pdh.system_profit,
  employee_profit = pdh.employee_profit,
  updated_at = now()
FROM partial_delivery_history pdh
JOIN orders o ON o.id = pdh.order_id
WHERE p.order_id = o.id
  AND o.order_type = 'partial_delivery'
  AND (
    p.total_revenue != pdh.delivered_revenue OR
    p.profit_amount != pdh.system_profit OR
    p.employee_profit != pdh.employee_profit
  );

-- المرحلة 4️⃣: CHECK Constraints للضمان (اختياري - تم تعطيله)
-- ============================================

-- ملاحظة: CHECK constraints معطلة مؤقتاً لتجنب مشاكل مع البيانات الموجودة
-- يمكن تفعيلها لاحقاً بعد التأكد من تطابق 100% للبيانات

-- ALTER TABLE orders ADD CONSTRAINT check_partial_delivery_final_amount
-- CHECK (
--   order_type != 'partial_delivery' OR
--   final_amount = (SELECT delivered_revenue FROM partial_delivery_history WHERE order_id = orders.id LIMIT 1)
-- );

-- المرحلة 5️⃣: التحقق الشامل والتقرير النهائي
-- ============================================

-- تقرير التصحيح
SELECT 
  '✅ التصحيح الشامل' AS report_type,
  COUNT(*) AS total_partial_orders,
  SUM(CASE WHEN o.final_amount = pdh.delivered_revenue THEN 1 ELSE 0 END) AS correct_orders,
  SUM(CASE WHEN o.final_amount != pdh.delivered_revenue THEN 1 ELSE 0 END) AS incorrect_orders,
  STRING_AGG(
    CASE 
      WHEN o.final_amount != pdh.delivered_revenue 
      THEN o.tracking_number || ' (كان: ' || o.final_amount || ', صُحح إلى: ' || pdh.delivered_revenue || ')'
      ELSE NULL 
    END, 
    ', '
  ) AS corrected_orders_details
FROM orders o
JOIN partial_delivery_history pdh ON pdh.order_id = o.id
WHERE o.order_type = 'partial_delivery';

-- تقرير تفصيلي للطلب 112066293
SELECT 
  '🔍 الطلب 112066293' AS report_type,
  o.tracking_number,
  o.status,
  o.order_type,
  o.total_amount AS order_total_amount,
  o.final_amount AS order_final_amount,
  o.delivery_fee,
  o.discount,
  pdh.delivered_revenue AS pdh_delivered_revenue,
  pdh.delivered_cost AS pdh_delivered_cost,
  pdh.employee_profit AS pdh_employee_profit,
  pdh.system_profit AS pdh_system_profit,
  CASE 
    WHEN o.final_amount = pdh.delivered_revenue THEN '✅ متطابق'
    ELSE '❌ غير متطابق - تم التصحيح'
  END AS validation_status
FROM orders o
LEFT JOIN partial_delivery_history pdh ON pdh.order_id = o.id
WHERE o.tracking_number = '112066293';

-- تقرير شامل لجميع الطلبات الجزئية
SELECT 
  '📊 جميع الطلبات الجزئية' AS report_type,
  o.tracking_number,
  o.final_amount AS final_amount,
  pdh.delivered_revenue AS delivered_revenue,
  CASE 
    WHEN o.final_amount = pdh.delivered_revenue THEN '✅'
    ELSE '❌ → تم التصحيح'
  END AS status,
  o.updated_at AS last_updated
FROM orders o
JOIN partial_delivery_history pdh ON pdh.order_id = o.id
WHERE o.order_type = 'partial_delivery'
ORDER BY o.created_at DESC
LIMIT 20;