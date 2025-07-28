-- إصلاح شامل: تسجيل الحركات المفقودة للطلبات المكتملة
DO $$ 
DECLARE
  main_cash_id UUID;
  order_rec RECORD;
  result_data jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- إضافة حركات تحصيل المبالغ للطلبات المكتملة
  FOR order_rec IN 
    SELECT o.id, o.order_number, o.final_amount, o.created_by, p.full_name
    FROM orders o
    JOIN profiles p ON o.created_by = p.user_id
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    AND NOT EXISTS (
      SELECT 1 FROM cash_movements cm 
      WHERE cm.reference_id = o.id 
      AND cm.reference_type = 'order_payment'
    )
  LOOP
    -- تسجيل تحصيل مبلغ الطلب
    SELECT public.update_cash_source_balance(
      main_cash_id,
      order_rec.final_amount,
      'in',
      'order_payment',
      order_rec.id,
      'تحصيل مبلغ الطلب ' || order_rec.order_number || ' - ' || order_rec.full_name,
      order_rec.created_by
    ) INTO result_data;
    
    RAISE NOTICE 'تم تسجيل تحصيل الطلب % بمبلغ %', order_rec.order_number, order_rec.final_amount;
  END LOOP;
  
  -- خصم مستحقات الموظف أحمد إذا لم تُخصم
  IF NOT EXISTS (
    SELECT 1 FROM cash_movements 
    WHERE reference_type = 'employee_dues' 
    AND description LIKE '%احمد%'
  ) THEN
    -- خصم 7000 د.ع مستحقات الموظف احمد
    SELECT public.update_cash_source_balance(
      main_cash_id,
      7000,
      'out',
      'employee_dues',
      (SELECT user_id FROM profiles WHERE full_name LIKE '%احمد%' LIMIT 1),
      'دفع مستحقات الموظف احمد - طلب ORD000004',
      '91484496-b887-44f7-9e5d-be9db5567604'
    ) INTO result_data;
    
    RAISE NOTICE 'تم خصم مستحقات الموظف احمد: 7000 د.ع';
  END IF;
  
END $$;