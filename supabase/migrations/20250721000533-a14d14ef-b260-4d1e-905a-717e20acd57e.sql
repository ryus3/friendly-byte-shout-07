-- إصلاح دالة حساب الأرباح التلقائية عند استلام الفاتورة
CREATE OR REPLACE FUNCTION public.auto_calculate_profit_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  order_revenue NUMERIC;
  order_cost NUMERIC;
  manager_profit NUMERIC;
  employee_profit NUMERIC := 0;
  employee_rules RECORD;
  main_cash_id UUID;
BEGIN
  -- التحقق من تغيير حالة استلام الفاتورة إلى true
  IF NEW.receipt_received = true AND (OLD.receipt_received = false OR OLD.receipt_received IS NULL) THEN
    
    -- حساب إجمالي الإيرادات والتكلفة للطلب
    SELECT 
      COALESCE(SUM(oi.total_price), 0) - COALESCE(NEW.discount, 0),
      COALESCE(SUM(oi.quantity * pv.cost_price), 0)
    INTO order_revenue, order_cost
    FROM public.order_items oi
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = NEW.id;
    
    -- حساب صافي ربح المدير
    manager_profit := order_revenue - order_cost;
    
    -- إذا كان الطلب من إنشاء المدير، الربح كامل للنظام
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604' THEN
      employee_profit := 0;
    ELSE
      -- البحث عن قواعد الربح للموظف
      SELECT * INTO employee_rules 
      FROM public.employee_profit_rules 
      WHERE employee_id = NEW.created_by 
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
    
    -- إدراج أو تحديث سجل الربح
    INSERT INTO public.profits (
      order_id,
      employee_id,
      total_revenue,
      total_cost,
      profit_amount,
      employee_profit,
      status
    ) VALUES (
      NEW.id,
      NEW.created_by,
      order_revenue,
      order_cost,
      manager_profit,
      employee_profit,
      'invoice_received'
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = EXCLUDED.status,
      updated_at = now();
    
    -- تحديث حالة الطلب إلى completed
    UPDATE public.orders 
    SET status = 'completed',
        receipt_received_at = now(),
        updated_at = now()
    WHERE id = NEW.id;
    
    -- تحديث رصيد القاصة الرئيسية
    PERFORM public.refresh_main_cash_balance();
    
    RAISE NOTICE 'تم حساب الربح للطلب %: إيرادات=%, تكلفة=%, ربح مدير=%, ربح موظف=%', 
                 NEW.order_number, order_revenue, order_cost, manager_profit, employee_profit;
  END IF;
  
  RETURN NEW;
END;
$$;