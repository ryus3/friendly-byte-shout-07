-- إصلاح النظام المالي ليكون تلقائي ومرتبط بقاعدة البيانات
-- الأرباح تُحسب فقط عند استلام فاتورة الطلب الواصل

-- 1. تنظيف البيانات الخاطئة أولاً
DELETE FROM public.cash_movements 
WHERE reference_type = 'realized_profit' 
AND cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية');

-- 2. إعادة تعيين رصيد القاصة الرئيسية لرأس المال فقط
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 3. إنشاء أو تحديث دالة لحساب الأرباح تلقائياً عند استلام الإيصال
CREATE OR REPLACE FUNCTION public.auto_calculate_profit_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
  main_cash_source_id UUID;
  total_cost DECIMAL(10,2) := 0;
  total_revenue DECIMAL(10,2) := 0;
  profit_amount DECIMAL(10,2) := 0;
  employee_profit DECIMAL(10,2) := 0;
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received 
     AND NEW.receipt_received = true THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية';
    
    -- حساب التكلفة والإيرادات للطلب
    SELECT 
      COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, pr.cost_price)), 0),
      NEW.total_amount - NEW.delivery_fee
    INTO total_cost, total_revenue
    FROM public.order_items oi
    LEFT JOIN public.products pr ON oi.product_id = pr.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = NEW.id;
    
    profit_amount := total_revenue - total_cost;
    employee_profit := profit_amount; -- 100% للموظف حسب النظام الحالي
    
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
      NEW.id,
      NEW.created_by,
      total_revenue,
      total_cost,
      profit_amount,
      100.0,
      employee_profit,
      'settled' -- مباشرة مسدد عند استلام الإيصال
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = 'settled',
      settled_at = now(),
      updated_at = now();
    
    -- إضافة الربح للقاصة الرئيسية تلقائياً
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      employee_profit,
      'in',
      'realized_profit',
      NEW.id,
      'ربح محقق من الطلب ' || NEW.order_number,
      NEW.created_by
    );
    
    RAISE NOTICE 'تم حساب وإضافة ربح قدره % للطلب %', employee_profit, NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ربط الدالة بجدول الطلبات (trigger)
DROP TRIGGER IF EXISTS trigger_auto_calculate_profit ON public.orders;
CREATE TRIGGER trigger_auto_calculate_profit
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_profit_on_receipt();

-- 5. إعادة حساب الأرباح للطلبات المستلمة فعلياً
DO $$
DECLARE
  order_record RECORD;
  main_cash_source_id UUID;
  total_cost DECIMAL(10,2);
  total_revenue DECIMAL(10,2);
  profit_amount DECIMAL(10,2);
  employee_profit DECIMAL(10,2);
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية';
  
  -- معالجة كل طلب مستلم الإيصال
  FOR order_record IN 
    SELECT * FROM public.orders 
    WHERE receipt_received = true
  LOOP
    -- حساب التكلفة والإيرادات
    SELECT 
      COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, pr.cost_price)), 0),
      order_record.total_amount - order_record.delivery_fee
    INTO total_cost, total_revenue
    FROM public.order_items oi
    LEFT JOIN public.products pr ON oi.product_id = pr.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = order_record.id;
    
    profit_amount := total_revenue - total_cost;
    employee_profit := profit_amount;
    
    -- تحديث جدول الأرباح
    INSERT INTO public.profits (
      order_id,
      employee_id,
      total_revenue,
      total_cost,
      profit_amount,
      employee_percentage,
      employee_profit,
      status,
      settled_at
    ) VALUES (
      order_record.id,
      order_record.created_by,
      total_revenue,
      total_cost,
      profit_amount,
      100.0,
      employee_profit,
      'settled',
      order_record.receipt_received_at
    )
    ON CONFLICT (order_id) DO UPDATE SET
      total_revenue = EXCLUDED.total_revenue,
      total_cost = EXCLUDED.total_cost,
      profit_amount = EXCLUDED.profit_amount,
      employee_profit = EXCLUDED.employee_profit,
      status = 'settled',
      settled_at = order_record.receipt_received_at,
      updated_at = now();
    
    -- إضافة الربح للقاصة الرئيسية
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      employee_profit,
      'in',
      'realized_profit',
      order_record.id,
      'ربح محقق من الطلب ' || order_record.order_number,
      order_record.created_by
    );
    
    RAISE NOTICE 'تم معالجة الطلب %: ربح = %', order_record.order_number, employee_profit;
  END LOOP;
END $$;