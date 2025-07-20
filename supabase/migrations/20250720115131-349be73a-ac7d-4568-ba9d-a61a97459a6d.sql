-- إنشاء trigger لإضافة أرباح المدير للقاصة الرئيسية عند استلام الفاتورة

-- دالة لإضافة ربح المدير للقاصة الرئيسية
CREATE OR REPLACE FUNCTION public.add_manager_profit_to_main_cash()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  manager_profit_amount numeric;
  order_record RECORD;
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received 
     AND NEW.receipt_received = true THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true;
    
    IF main_cash_source_id IS NULL THEN
      RAISE WARNING 'القاصة الرئيسية غير موجودة';
      RETURN NEW;
    END IF;
    
    -- الحصول على ربح المدير من جدول الأرباح
    SELECT (profit_amount - employee_profit) INTO manager_profit_amount
    FROM public.profits 
    WHERE order_id = NEW.id;
    
    -- إذا كان هناك ربح للمدير، أضفه للقاصة الرئيسية
    IF manager_profit_amount > 0 THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        manager_profit_amount,
        'in',
        'realized_profit',
        NEW.id,
        'ربح محقق من الطلب رقم ' || NEW.order_number,
        NEW.created_by
      );
      
      RAISE NOTICE 'تم إضافة ربح المدير % للقاصة الرئيسية للطلب %', manager_profit_amount, NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء trigger على جدول الطلبات
CREATE TRIGGER trigger_add_manager_profit_to_cash
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.add_manager_profit_to_main_cash();

-- إضافة الأرباح المحققة الموجودة للقاصة الرئيسية
DO $$
DECLARE
  main_cash_source_id uuid;
  profit_record RECORD;
  manager_profit_amount numeric;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true;
  
  IF main_cash_source_id IS NOT NULL THEN
    -- معالجة الأرباح المحققة الموجودة
    FOR profit_record IN 
      SELECT p.*, o.order_number, o.created_by
      FROM public.profits p
      JOIN public.orders o ON p.order_id = o.id
      WHERE o.receipt_received = true
      AND NOT EXISTS (
        SELECT 1 FROM public.cash_movements cm 
        WHERE cm.reference_type = 'realized_profit' 
        AND cm.reference_id = o.id
      )
    LOOP
      manager_profit_amount := profit_record.profit_amount - profit_record.employee_profit;
      
      IF manager_profit_amount > 0 THEN
        PERFORM public.update_cash_source_balance(
          main_cash_source_id,
          manager_profit_amount,
          'in',
          'realized_profit',
          profit_record.order_id,
          'ربح محقق من الطلب رقم ' || profit_record.order_number,
          profit_record.created_by
        );
        
        RAISE NOTICE 'تم إضافة ربح المدير % للقاصة الرئيسية للطلب %', manager_profit_amount, profit_record.order_number;
      END IF;
    END LOOP;
  END IF;
END $$;