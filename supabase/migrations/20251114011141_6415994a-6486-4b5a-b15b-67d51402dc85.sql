-- ✅ إصلاح شامل لجميع حالات طلبات الوسيط
-- تصحيح الحالات بناءً على delivery_status فقط

-- تحديث الطلبات حسب delivery_status
UPDATE orders 
SET status = CASE 
    -- pending: الحالة 1 (فعال - قيد التجهيز)
    WHEN delivery_status = '1' THEN 'pending'
    
    -- shipped: الحالات النشطة 2,7,8,9,10,11
    WHEN delivery_status IN ('2', '7', '8', '9', '10', '11') THEN 'shipped'
    
    -- delivery: جميع حالات التوصيل والمشاكل
    WHEN delivery_status IN ('3', '5', '6', '14', '18', '22', '23', '24', '25', '26', '27', '28', '29', '30', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') THEN 'delivery'
    
    -- delivered: الحالة 4 فقط
    WHEN delivery_status = '4' THEN 'delivered'
    
    -- returned_in_stock: الحالة 17 فقط (تم الإرجاع للتاجر)
    WHEN delivery_status = '17' THEN 'returned_in_stock'
    
    -- cancelled: حالات الإلغاء والرفض 31,32
    WHEN delivery_status IN ('31', '32') THEN 'cancelled'
    
    -- returned: حالات الإرجاع الأخرى 12,13,15,16,19,20,21
    WHEN delivery_status IN ('12', '13', '15', '16', '19', '20', '21') THEN 'returned'
    
    ELSE status
  END,
  status_changed_at = CASE 
    WHEN status != (CASE 
        WHEN delivery_status = '1' THEN 'pending'
        WHEN delivery_status IN ('2', '7', '8', '9', '10', '11') THEN 'shipped'
        WHEN delivery_status IN ('3', '5', '6', '14', '18', '22', '23', '24', '25', '26', '27', '28', '29', '30', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44') THEN 'delivery'
        WHEN delivery_status = '4' THEN 'delivered'
        WHEN delivery_status = '17' THEN 'returned_in_stock'
        WHEN delivery_status IN ('31', '32') THEN 'cancelled'
        WHEN delivery_status IN ('12', '13', '15', '16', '19', '20', '21') THEN 'returned'
        ELSE status
      END) 
    THEN NOW() 
    ELSE status_changed_at 
  END,
  updated_at = NOW()
WHERE delivery_partner = 'alwaseet'
  AND delivery_status IS NOT NULL
  AND status NOT IN ('completed');

-- تحديث الطلبات الخمسة المحددة فوراً (من الأخطاء)
UPDATE orders
SET status = 'pending',
    status_changed_at = NOW(),
    updated_at = NOW()
WHERE tracking_number IN ('112066287', '112066293', '112066295', '112066300', '112066282')
  AND delivery_status = '1'
  AND status != 'pending';