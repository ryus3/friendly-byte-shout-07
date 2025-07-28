-- حذف التعديلات السابقة لرسوم التوصيل
DROP TRIGGER IF EXISTS auto_record_delivery_expense_on_completed ON orders;
DROP FUNCTION IF EXISTS record_delivery_expense_for_completed_order();

-- حذف المصاريف المسجلة خطأ لرسوم التوصيل
DELETE FROM expenses 
WHERE category = 'رسوم التوصيل' 
AND expense_type = 'system' 
AND description LIKE '%رسوم توصيل طلب%';

-- حذف الحركات النقدية الخاطئة لرسوم التوصيل
DELETE FROM cash_movements 
WHERE reference_type = 'delivery_expense' 
AND description LIKE '%رسوم توصيل طلب%';

-- إعادة حساب رصيد القاصة الرئيسية الصحيح
CREATE OR REPLACE FUNCTION public.calculate_enhanced_main_cash_balance_v2()
RETURNS TABLE(
  capital_value numeric,
  total_revenue numeric,
  total_cogs numeric,
  gross_profit numeric,
  total_expenses numeric,
  total_purchases numeric,
  employee_profits numeric,
  net_profit numeric,
  final_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  main_cash_id UUID;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  RETURN QUERY
  WITH financial_data AS (
    -- رأس المال
    SELECT 
      COALESCE((value)::numeric, 0) as capital_amount,
      0::numeric as revenue_amount,
      0::numeric as cogs_amount,
      0::numeric as expense_amount,
      0::numeric as purchase_amount,
      0::numeric as employee_profit_amount
    FROM settings WHERE key = 'initial_capital'
    
    UNION ALL
    
    -- إجمالي الإيرادات من الطلبات المكتملة (المبلغ المستلم فعلياً بدون رسوم التوصيل)
    SELECT 
      0::numeric,
      COALESCE(SUM(o.total_amount - o.delivery_fee), 0), -- المبلغ بدون رسوم التوصيل
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric
    FROM orders o
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    
    UNION ALL
    
    -- تكلفة البضائع المباعة (COGS) - للطلبات المكتملة فقط
    SELECT 
      0::numeric,
      0::numeric,
      COALESCE(SUM(pv.cost_price * oi.quantity), 0),
      0::numeric,
      0::numeric,
      0::numeric
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    
    UNION ALL
    
    -- المصاريف العامة (بدون مستحقات الموظفين ورسوم التوصيل)
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(amount), 0),
      0::numeric,
      0::numeric
    FROM expenses 
    WHERE status = 'approved' 
    AND expense_type != 'system'
    AND category != 'مستحقات الموظفين'
    AND category != 'رسوم التوصيل'
    
    UNION ALL
    
    -- المشتريات من القاصة الرئيسية
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(total_amount), 0),
      0::numeric
    FROM purchases 
    WHERE cash_source_id = main_cash_id
    
    UNION ALL
    
    -- مستحقات الموظفين المدفوعة (من المصاريف النظامية)
    SELECT 
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      0::numeric,
      COALESCE(SUM(amount), 0)
    FROM expenses 
    WHERE status = 'approved' 
    AND expense_type = 'system'
    AND category = 'مستحقات الموظفين'
  )
  SELECT 
    SUM(fd.capital_amount),
    SUM(fd.revenue_amount),
    SUM(fd.cogs_amount),
    SUM(fd.revenue_amount) - SUM(fd.cogs_amount), -- الربح الخام
    SUM(fd.expense_amount),
    SUM(fd.purchase_amount),
    SUM(fd.employee_profit_amount), -- مستحقات الموظفين المدفوعة
    (SUM(fd.revenue_amount) - SUM(fd.cogs_amount)) - SUM(fd.expense_amount) - SUM(fd.employee_profit_amount), -- صافي الربح
    SUM(fd.capital_amount) + SUM(fd.revenue_amount) - SUM(fd.cogs_amount) - SUM(fd.expense_amount) - SUM(fd.purchase_amount) - SUM(fd.employee_profit_amount) -- الرصيد النهائي
  FROM financial_data fd;
END;
$function$;

-- دالة لحساب الرصيد الصحيح للقاصة الرئيسية
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance_v2()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_data record;
BEGIN
  SELECT * INTO result_data FROM calculate_enhanced_main_cash_balance_v2();
  RETURN result_data.final_balance;
END;
$function$;

-- تحديث الدالة الرئيسية لتستخدم النسخة الجديدة
DROP FUNCTION IF EXISTS calculate_enhanced_main_cash_balance();
DROP FUNCTION IF EXISTS calculate_main_cash_balance();

CREATE OR REPLACE FUNCTION public.calculate_enhanced_main_cash_balance()
RETURNS TABLE(
  capital_value numeric,
  total_revenue numeric,
  total_cogs numeric,
  gross_profit numeric,
  total_expenses numeric,
  total_purchases numeric,
  employee_profits numeric,
  net_profit numeric,
  final_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT * FROM calculate_enhanced_main_cash_balance_v2();
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN calculate_main_cash_balance_v2();
END;
$function$;

-- إضافة دالة لتسجيل الإيرادات عند استلام الطلب
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  main_cash_id UUID;
  actual_revenue NUMERIC;
BEGIN
  -- عند تحديد أن الفاتورة استُلمت
  IF NEW.receipt_received = true AND OLD.receipt_received = false AND NEW.status = 'completed' THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    
    -- حساب الإيراد الفعلي (بدون رسوم التوصيل)
    actual_revenue := NEW.total_amount - NEW.delivery_fee;
    
    -- إضافة الإيراد للقاصة الرئيسية
    IF main_cash_id IS NOT NULL AND actual_revenue > 0 THEN
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        actual_revenue,
        'in',
        'order_revenue',
        NEW.id,
        'إيراد طلب رقم ' || NEW.order_number || ' (بدون رسوم التوصيل)',
        NEW.receipt_received_by
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء التريغر لتسجيل الإيرادات
DROP TRIGGER IF EXISTS record_order_revenue_on_receipt ON orders;
CREATE TRIGGER record_order_revenue_on_receipt
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_revenue_on_receipt();