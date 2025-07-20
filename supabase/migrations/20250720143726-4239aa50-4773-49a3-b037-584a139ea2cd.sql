-- إصلاح نظام إضافة الأرباح للقاصة الرئيسية تلقائياً

-- 1. حذف الـ triggers المكررة للطلبات
DROP TRIGGER IF EXISTS handle_order_cash_flow_trigger ON public.orders;
DROP TRIGGER IF EXISTS order_cash_flow_trigger ON public.orders;
DROP TRIGGER IF EXISTS trigger_add_manager_profit_to_cash ON public.orders;
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt_received ON public.orders;

-- 2. حذف الدوال غير المستخدمة
DROP FUNCTION IF EXISTS public.handle_order_cash_flow();
DROP FUNCTION IF EXISTS public.add_manager_profit_to_main_cash();

-- 3. إنشاء دالة موحدة لمعالجة أرباح الطلبات وإضافتها للقاصة
CREATE OR REPLACE FUNCTION public.process_order_profit_to_cash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id UUID;
  profit_record RECORD;
  total_net_profit NUMERIC := 0;
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received 
     AND NEW.receipt_received = true THEN
    
    -- حساب الأرباح أولاً
    PERFORM calculate_order_profit_fixed_amounts(NEW.id);
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true;
    
    IF main_cash_source_id IS NULL THEN
      RAISE EXCEPTION 'القاصة الرئيسية غير موجودة';
    END IF;
    
    -- الحصول على تفاصيل الربح المحسوب
    SELECT * INTO profit_record
    FROM public.profits 
    WHERE order_id = NEW.id;
    
    IF profit_record IS NOT NULL THEN
      -- حساب صافي الربح (الربح الإجمالي - ربح الموظف للمديرين فقط)
      IF profit_record.employee_percentage = 0 THEN
        -- المدير: صافي الربح = الربح الإجمالي
        total_net_profit := profit_record.profit_amount;
      ELSE
        -- الموظف: صافي الربح = الربح الإجمالي - ربح الموظف
        total_net_profit := profit_record.profit_amount - profit_record.employee_profit;
      END IF;
      
      -- إضافة صافي الربح للقاصة الرئيسية
      IF total_net_profit > 0 THEN
        PERFORM public.update_cash_source_balance(
          main_cash_source_id,
          total_net_profit,
          'in',
          'order_profit',
          NEW.id,
          'صافي ربح طلب رقم: ' || NEW.order_number,
          NEW.created_by
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. إنشاء trigger واحد موحد للطلبات
CREATE TRIGGER trigger_process_order_profit_to_cash
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_order_profit_to_cash();

-- 5. دالة لمعالجة الإضافات اليدوية للنقد
CREATE OR REPLACE FUNCTION public.handle_manual_cash_addition(
  p_cash_source_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_created_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- إضافة المبلغ للمصدر النقدي
  RETURN public.update_cash_source_balance(
    p_cash_source_id,
    p_amount,
    'in',
    'manual_addition',
    gen_random_uuid(),
    p_description,
    p_created_by
  );
END;
$$;

-- 6. دالة لحساب الرصيد الصحيح للقاصة الرئيسية
CREATE OR REPLACE FUNCTION public.recalculate_main_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id UUID;
  calculated_balance NUMERIC := 0;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true;
  
  IF main_cash_source_id IS NULL THEN
    RAISE EXCEPTION 'القاصة الرئيسية غير موجودة';
  END IF;
  
  -- حساب الرصيد الصحيح من جميع الحركات
  SELECT 
    cs.initial_balance + 
    COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0)
  INTO calculated_balance
  FROM public.cash_sources cs
  LEFT JOIN public.cash_movements cm ON cs.id = cm.cash_source_id
  WHERE cs.id = main_cash_source_id
  GROUP BY cs.id, cs.initial_balance;
  
  -- تحديث الرصيد في الجدول
  UPDATE public.cash_sources 
  SET current_balance = calculated_balance,
      updated_at = now()
  WHERE id = main_cash_source_id;
  
  RETURN calculated_balance;
END;
$$;