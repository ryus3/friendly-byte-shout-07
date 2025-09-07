-- إصلاح function حساب الأرباح - إزالة المرجع للحقل غير الموجود
CREATE OR REPLACE FUNCTION public.auto_calculate_profit_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  order_record RECORD;
  profit_exists BOOLEAN := false;
  total_revenue NUMERIC := 0;
  total_cost NUMERIC := 0;
  profit_amount NUMERIC := 0;
  employee_percentage NUMERIC := 0;
  employee_profit NUMERIC := 0;
BEGIN
  -- فقط عندما يتم استلام الفاتورة (receipt_received = true)
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- جلب تفاصيل الطلب
    SELECT * INTO order_record FROM orders WHERE id = NEW.id;
    
    -- التحقق من وجود سجل أرباح مسبق
    SELECT EXISTS(SELECT 1 FROM profits WHERE order_id = NEW.id) INTO profit_exists;
    
    -- إذا لم يوجد سجل أرباح، قم بحسابه
    IF NOT profit_exists THEN
      -- حساب الإيرادات والتكاليف (استخدام سعر الشراء من المنتج فقط)
      SELECT 
        COALESCE(SUM(oi.total_price), 0),
        COALESCE(SUM(oi.quantity * COALESCE(p.purchase_price, 0)), 0)
      INTO total_revenue, total_cost
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.id;
      
      profit_amount := total_revenue - total_cost;
      
      -- الحصول على نسبة الموظف (افتراضي 20%)
      SELECT COALESCE(
        (SELECT percentage FROM employee_profit_rules 
         WHERE employee_id = order_record.created_by 
         AND is_active = true 
         ORDER BY created_at DESC 
         LIMIT 1), 
        20.0
      ) INTO employee_percentage;
      
      employee_profit := profit_amount * (employee_percentage / 100.0);
      
      -- إدراج سجل الأرباح
      INSERT INTO profits (
        order_id, 
        employee_id, 
        total_revenue, 
        total_cost, 
        profit_amount, 
        employee_percentage, 
        employee_profit, 
        status
      ) VALUES (
        NEW.id,
        order_record.created_by,
        total_revenue,
        total_cost,
        profit_amount,
        employee_percentage,
        employee_profit,
        'pending'
      );
      
      RAISE NOTICE 'تم إنشاء سجل أرباح للطلب % - ربح الموظف: %', order_record.order_number, employee_profit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;