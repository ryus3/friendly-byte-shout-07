-- تصحيح مباشر بدون WHERE معقد
-- الطلب 112552848
DO $$
BEGIN
  UPDATE orders 
  SET final_amount = 61000, total_amount = 56000, updated_at = NOW()
  WHERE tracking_number = '112552848';
  
  RAISE NOTICE 'تم تحديث 112552848';
END $$;

-- الطلب 112066293
DO $$
BEGIN
  UPDATE orders 
  SET final_amount = 33000, total_amount = 28000, updated_at = NOW()
  WHERE tracking_number = '112066293';
  
  RAISE NOTICE 'تم تحديث 112066293';
END $$;

-- التحقق النهائي
SELECT 
  tracking_number,
  final_amount,
  total_amount,
  discount,
  order_type
FROM orders
WHERE tracking_number IN ('112552848', '112066293')
ORDER BY tracking_number;