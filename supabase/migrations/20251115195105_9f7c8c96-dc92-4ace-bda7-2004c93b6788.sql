-- إصلاح فوري: إعادة الطلبات التي كانت completed وتحولت خطأ
-- نتعرف عليها من: receipt_received = true + status تغير عن completed

UPDATE orders
SET status = 'completed', updated_at = NOW()
WHERE receipt_received = true
  AND status IN ('delivery', 'delivered', 'shipped', 'returned', 'pending')
  AND delivery_partner = 'alwaseet';

-- تفسير: إذا استلمت الإيصال → يجب أن يكون completed دائماً