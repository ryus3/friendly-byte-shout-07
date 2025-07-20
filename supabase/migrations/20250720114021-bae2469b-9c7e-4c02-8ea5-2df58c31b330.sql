-- إصلاح دالة حساب الأرباح للطلبات مع المبالغ الثابتة
CREATE OR REPLACE FUNCTION public.calculate_order_profit_fixed_amounts(order_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  order_record RECORD;
  item_record RECORD;
  total_cost DECIMAL(10,2) := 0;
  total_revenue DECIMAL(10,2) := 0;
  total_profit DECIMAL(10,2) := 0;
  employee_profit DECIMAL(10,2) := 0;
  employee_percentage DECIMAL(5,2) := 0;
BEGIN
  -- الحصول على تفاصيل الطلب
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_id_input;
  
  IF order_record IS NULL THEN
    RETURN;
  END IF;
  
  -- حساب التكلفة والإيرادات والأرباح لكل عنصر
  FOR item_record IN 
    SELECT 
      oi.*,
      COALESCE(pv.cost_price, p.cost_price) as item_cost_price,
      COALESCE(pv.profit_amount, p.profit_amount, 0) as item_profit_amount
    FROM public.order_items oi
    LEFT JOIN public.products p ON oi.product_id = p.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = order_id_input
  LOOP
    total_cost := total_cost + (item_record.item_cost_price * item_record.quantity);
    total_revenue := total_revenue + item_record.total_price;
    
    -- حساب ربح الموظف للعنصر الحالي باستخدام الدالة الصحيحة
    employee_profit := employee_profit + public.calculate_employee_item_profit(
      order_record.created_by,
      item_record.product_id,
      item_record.variant_id,
      item_record.quantity,
      item_record.item_profit_amount
    );
  END LOOP;
  
  total_profit := total_revenue - total_cost;
  
  -- تحديد نسبة الموظف (0% للمدير، نسبة للموظفين)
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = order_record.created_by 
        AND r.name IN ('super_admin', 'admin')
        AND ur.is_active = true
      ) THEN 0.0
      ELSE 100.0
    END
  INTO employee_percentage;
  
  -- إدراج أو تحديث سجل الأرباح
  INSERT INTO public.profits (
    order_id,
    employee_id,
    total_revenue,
    total_cost,
    profit_amount,
    employee_percentage,
    employee_profit,
    status
  ) VALUES (
    order_id_input,
    order_record.created_by,
    total_revenue,
    total_cost,
    total_profit,
    employee_percentage,
    employee_profit,
    'pending'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    profit_amount = EXCLUDED.profit_amount,
    employee_percentage = EXCLUDED.employee_percentage,
    employee_profit = EXCLUDED.employee_profit,
    updated_at = now();
END;
$function$;

-- إضافة محفز لحساب الأرباح تلقائياً عند استلام الفاتورة
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt_received ON public.orders;

CREATE TRIGGER trigger_calculate_profit_on_receipt_received
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_profit_on_receipt();

-- الآن دعنا نحسب الأرباح للطلبات الموجودة
SELECT calculate_order_profit_fixed_amounts('00798655-f91d-45d4-b1b5-e1dfc1a47266'::uuid);
SELECT calculate_order_profit_fixed_amounts('d134d21c-f8b6-4b35-b2a3-d420819ac31f'::uuid);