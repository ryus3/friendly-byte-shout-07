-- إصلاح الطلبين المتبقيين
UPDATE orders 
SET 
  status = 'cancelled',
  delivery_status = 'رفض الطلب',
  updated_at = now()
WHERE order_number = 'ORD000010';

UPDATE orders 
SET 
  status = 'pending', 
  delivery_status = 'فعال',
  updated_at = now()
WHERE order_number = 'ORD000009';

-- التأكد من أن جميع طلبات الوسيط لها حالات صحيحة
UPDATE orders 
SET delivery_status = CASE 
  WHEN status = 'pending' THEN 'فعال'
  WHEN status = 'cancelled' THEN 'رفض الطلب'
  WHEN status = 'completed' THEN 'تم التسليم للعميل'
  WHEN status = 'delivered' THEN 'تم التسليم للعميل'
  WHEN status = 'returned' THEN 'راجع'
  WHEN status = 'returned_in_stock' THEN 'راجع للمخزن'
  ELSE delivery_status
END
WHERE delivery_partner = 'alwaseet' 
AND delivery_status IS NOT NULL;