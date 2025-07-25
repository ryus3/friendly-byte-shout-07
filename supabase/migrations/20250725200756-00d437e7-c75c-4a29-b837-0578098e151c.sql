-- إضافة النقاط للطلبات المكتملة الموجودة
DO $$
DECLARE
  order_record RECORD;
  points_to_add INTEGER;
  existing_loyalty_id UUID;
BEGIN
  -- معالجة كل طلب مكتمل
  FOR order_record IN 
    SELECT o.*, c.id as customer_id
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.status IN ('completed', 'delivered') 
    AND o.receipt_received = true
  LOOP
    -- حساب النقاط (100 نقطة لكل 1000 دينار)
    points_to_add := FLOOR(order_record.final_amount / 1000) * 100;
    
    RAISE NOTICE 'معالجة الطلب % للعميل %: مبلغ=%, نقاط=%', 
                 order_record.order_number, order_record.customer_name, 
                 order_record.final_amount, points_to_add;
    
    -- إنشاء أو تحديث سجل الولاء للعميل
    INSERT INTO public.customer_loyalty (customer_id, total_points, total_spent, total_orders)
    VALUES (order_record.customer_id, points_to_add, order_record.final_amount, 1)
    ON CONFLICT (customer_id) DO UPDATE SET
      total_points = customer_loyalty.total_points + points_to_add,
      total_spent = customer_loyalty.total_spent + order_record.final_amount,
      total_orders = customer_loyalty.total_orders + 1,
      updated_at = now();
    
    -- إضافة سجل تاريخ النقاط
    INSERT INTO public.loyalty_points_history (
      customer_id,
      order_id,
      points_earned,
      transaction_type,
      description
    ) VALUES (
      order_record.customer_id,
      order_record.id,
      points_to_add,
      'earned',
      'نقاط من طلب رقم ' || order_record.order_number || ' (إضافة تلقائية)'
    ) ON CONFLICT DO NOTHING;
    
  END LOOP;
  
  -- تحديث مستويات العملاء
  UPDATE public.customer_loyalty 
  SET current_tier_id = (
    SELECT id FROM public.loyalty_tiers 
    WHERE points_required <= customer_loyalty.total_points
    ORDER BY points_required DESC 
    LIMIT 1
  ),
  last_tier_upgrade = now()
  WHERE current_tier_id IS NULL;
  
  RAISE NOTICE 'تم إضافة النقاط لجميع الطلبات المكتملة وتحديث المستويات';
END $$;