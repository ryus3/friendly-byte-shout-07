-- تحديث الطلب 112762972 مع تفعيل triggers للحسابات الصحيحة
-- الـ triggers ستحسب تلقائياً: sales_amount = 26,000 و final_amount = 31,000

UPDATE orders 
SET 
  total_amount = 26000,
  discount = 2000,
  delivery_fee = 5000,
  price_increase = 0,
  price_change_type = 'discount'
WHERE tracking_number = '112762972';

-- التحقق من النتيجة
DO $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    tracking_number,
    total_amount,
    discount,
    delivery_fee,
    sales_amount,
    final_amount,
    price_increase,
    price_change_type
  INTO v_order
  FROM orders
  WHERE tracking_number = '112762762';
  
  RAISE NOTICE 'Order 112762972 updated successfully:';
  RAISE NOTICE 'total_amount: %, discount: %, delivery_fee: %', v_order.total_amount, v_order.discount, v_order.delivery_fee;
  RAISE NOTICE 'sales_amount: %, final_amount: %', v_order.sales_amount, v_order.final_amount;
  RAISE NOTICE 'Expected: sales_amount = 26000, final_amount = 31000';
END $$;