-- 1️⃣ تصحيح الحالات الخاطئة في قاعدة البيانات

-- تصحيح الطلبات بـ delivery_status='1' لكن status='delivery'
UPDATE orders 
SET status = 'pending',
    status_changed_at = NOW(),
    updated_at = NOW()
WHERE delivery_status = '1'
  AND status = 'delivery'
  AND delivery_partner = 'alwaseet';

-- تصحيح شامل لجميع الحالات المتعارضة بناءً على alwaseet-statuses.js
UPDATE orders 
SET status = CASE 
    -- الحالات الأساسية
    WHEN delivery_status = '1' THEN 'pending'
    
    -- حالات الشحن (2, 7, 8, 9, 10, 11)
    WHEN delivery_status IN ('2', '7', '8', '9', '10', '11') THEN 'shipped'
    
    -- حالات التوصيل النشطة
    WHEN delivery_status IN ('3', '5', '6', '14', '18', '22', '23', '24', '25', '26', '27', '28', '29', '30', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') THEN 'delivery'
    
    -- الحالة 4 = delivered
    WHEN delivery_status = '4' THEN 'delivered'
    
    -- الحالة 17 = returned_in_stock
    WHEN delivery_status = '17' THEN 'returned_in_stock'
    
    -- حالات الإلغاء (31, 32)
    WHEN delivery_status IN ('31', '32') THEN 'cancelled'
    
    -- حالات الإرجاع
    WHEN delivery_status IN ('12', '13', '15', '16', '19', '20', '21') THEN 'returned'
    
    ELSE status
  END,
  status_changed_at = NOW(),
  updated_at = NOW()
WHERE delivery_partner = 'alwaseet'
  AND delivery_status IS NOT NULL
  AND status NOT IN ('completed', 'cancelled');

-- 2️⃣ تحديث حركات النقد لاستخدام tracking_number

-- تحديث أوصاف حركات النقد في جدول cash_movements
UPDATE cash_movements cm
SET description = CASE 
    -- إيرادات البيع (دخل)
    WHEN cm.movement_type = 'in' AND cm.reference_type = 'order' 
      THEN CONCAT('إيراد بيع طلب ', o.tracking_number)
    
    -- دفعات الطلبات (خرج)
    WHEN cm.movement_type = 'out' AND cm.reference_type = 'order' AND cm.description LIKE '%دفع%'
      THEN CONCAT('دفع طلب ', o.tracking_number)
    
    -- رسوم التوصيل (خرج)
    WHEN cm.movement_type = 'out' AND cm.reference_type = 'order' AND cm.description LIKE '%رسوم توصيل%'
      THEN CONCAT('رسوم توصيل تبديل - طلب ', o.tracking_number)
    
    ELSE cm.description
  END
FROM orders o
WHERE cm.reference_id = o.id
  AND cm.reference_type = 'order'
  AND cm.description LIKE '%ORD%';