-- إعادة حساب المبالغ للطلب 112762972 باستخدام الدوال المحدَّثة
-- هذا التحديث لا يغيّر القيم المنطقية، فقط يفعّل trigger normalize_amounts_before_update

UPDATE orders 
SET 
  total_amount = total_amount,
  delivery_fee = delivery_fee
WHERE tracking_number = '112762972';

-- التحقق من النتيجة بعد تشغيل الـ trigger
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
  WHERE tracking_number = '112762972';
  
  RAISE NOTICE 'Order 112762972 after normalize_order_amounts:';
  RAISE NOTICE 'total_amount: %, discount: %, delivery_fee: %', v_order.total_amount, v_order.discount, v_order.delivery_fee;
  RAISE NOTICE 'sales_amount: %, final_amount: %', v_order.sales_amount, v_order.final_amount;
  RAISE NOTICE 'Expected: sales_amount = 26000, final_amount = 31000';
END $$;