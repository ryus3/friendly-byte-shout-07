-- إضافة دالة لحساب الأرباح للطلبات المكتملة بدون سجلات أرباح
CREATE OR REPLACE FUNCTION public.calculate_missing_profits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_record RECORD;
  order_revenue NUMERIC;
  order_cost NUMERIC;
  manager_profit NUMERIC;
  employee_profit NUMERIC := 0;
  employee_rules RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- البحث عن الطلبات المكتملة التي لا تحتوي على سجلات أرباح
  FOR order_record IN 
    SELECT o.* FROM public.orders o
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    AND NOT EXISTS (
      SELECT 1 FROM public.profits p WHERE p.order_id = o.id
    )
  LOOP
    -- حساب إجمالي الإيرادات والتكلفة للطلب
    SELECT 
      COALESCE(SUM(oi.total_price), 0) - COALESCE(order_record.discount, 0),
      COALESCE(SUM(oi.quantity * pv.cost_price), 0)
    INTO order_revenue, order_cost
    FROM public.order_items oi
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = order_record.id;
    
    -- حساب صافي ربح المدير
    manager_profit := order_revenue - order_cost;
    
    -- إذا كان الطلب من إنشاء المدير، الربح كامل للنظام
    IF order_record.created_by = '91484496-b887-44f7-9e5d-be9db5567604' THEN
      employee_profit := 0;
    ELSE
      -- البحث عن قواعد الربح للموظف
      SELECT * INTO employee_rules 
      FROM public.employee_profit_rules 
      WHERE employee_id = order_record.created_by 
      AND is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1;
      
      -- حساب ربح الموظف حسب القواعد المحددة
      IF employee_rules.rule_type IS NOT NULL THEN
        IF employee_rules.rule_type = 'percentage' THEN
          employee_profit := manager_profit * (employee_rules.profit_percentage / 100);
        ELSIF employee_rules.rule_type = 'fixed' THEN
          employee_profit := employee_rules.profit_amount;
        ELSE
          employee_profit := 0;
        END IF;
      ELSE
        -- إذا لم توجد قواعد محددة، لا يوجد ربح للموظف
        employee_profit := 0;
      END IF;
    END IF;
    
    -- إدراج سجل الربح
    INSERT INTO public.profits (
      order_id,
      employee_id,
      total_revenue,
      total_cost,
      profit_amount,
      employee_profit,
      status,
      created_at,
      updated_at
    ) VALUES (
      order_record.id,
      order_record.created_by,
      order_revenue,
      order_cost,
      manager_profit,
      employee_profit,
      'settled', -- مستقرة لأن الطلب مكتمل والفاتورة مستلمة
      order_record.receipt_received_at,
      now()
    );
    
    processed_count := processed_count + 1;
    
    RAISE NOTICE 'تم حساب الربح للطلب %: إيرادات=%, تكلفة=%, ربح مدير=%, ربح موظف=%', 
                 order_record.order_number, order_revenue, order_cost, manager_profit, employee_profit;
  END LOOP;
  
  -- إضافة إشعار إذا تم معالجة طلبات
  IF processed_count > 0 THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      data,
      user_id
    ) VALUES (
      'تم حساب الأرباح المفقودة',
      'تم حساب الأرباح لـ ' || processed_count || ' طلب مكتمل',
      'profit_calculation',
      'medium',
      jsonb_build_object('processed_count', processed_count),
      '91484496-b887-44f7-9e5d-be9db5567604'
    );
  END IF;
  
  RETURN processed_count;
END;
$function$;