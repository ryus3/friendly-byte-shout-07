-- إصلاح النظام: ربط المصاريف بحركات النقد
-- إضافة trigger لتحديث رصيد القاصة عند إضافة مصروف

CREATE OR REPLACE FUNCTION public.process_expense_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_source_id UUID;
  expense_record RECORD;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية';
  
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    -- إنشاء حركة سحب للمصروف المعتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    );
    
    RAISE NOTICE 'تم سحب مصروف: % بقيمة: %', NEW.description, NEW.amount;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- إنشاء حركة سحب عند تغيير حالة المصروف إلى معتمد
    PERFORM public.update_cash_source_balance(
      main_cash_source_id,
      NEW.amount,
      'out',
      'expense',
      NEW.id,
      'مصروف: ' || NEW.description,
      NEW.created_by
    );
    
    RAISE NOTICE 'تم اعتماد وسحب مصروف: % بقيمة: %', NEW.description, NEW.amount;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- استرداد المبلغ عند حذف المصروف المعتمد
    IF OLD.status = 'approved' THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        OLD.amount,
        'in',
        'expense_refund',
        OLD.id,
        'استرداد مصروف محذوف: ' || OLD.description,
        OLD.created_by
      );
      
      RAISE NOTICE 'تم استرداد مبلغ مصروف محذوف: % بقيمة: %', OLD.description, OLD.amount;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إنشاء trigger للمصاريف
DROP TRIGGER IF EXISTS expense_cash_movement_trigger ON public.expenses;
CREATE TRIGGER expense_cash_movement_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.process_expense_cash_movement();

-- إضافة مصاريف فاتورة رقم 2 إذا لم تكن موجودة
DO $$
DECLARE
  purchase_record RECORD;
  current_user_id UUID;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- الحصول على فاتورة رقم 2
  SELECT * INTO purchase_record FROM public.purchases WHERE purchase_number = '2';
  
  IF purchase_record.id IS NOT NULL THEN
    -- إضافة مصروف الشحن إذا كان موجود
    IF purchase_record.shipping_cost > 0 AND NOT EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE receipt_number = purchase_record.purchase_number || '-SHIP'
    ) THEN
      INSERT INTO public.expenses (
        category,
        expense_type,
        description,
        amount,
        vendor_name,
        receipt_number,
        status,
        created_by
      ) VALUES (
        'شحن ونقل',
        'operational',
        'تكلفة شحن فاتورة شراء ' || purchase_record.purchase_number || ' - ' || purchase_record.supplier_name,
        purchase_record.shipping_cost,
        purchase_record.supplier_name,
        purchase_record.purchase_number || '-SHIP',
        'approved',
        current_user_id
      );
    END IF;
    
    -- إضافة مصروف التحويل إذا كان موجود
    IF purchase_record.transfer_cost > 0 AND NOT EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE receipt_number = purchase_record.purchase_number || '-TRANSFER'
    ) THEN
      INSERT INTO public.expenses (
        category,
        expense_type,
        description,
        amount,
        vendor_name,
        receipt_number,
        status,
        created_by
      ) VALUES (
        'رسوم تحويل',
        'operational',
        'رسوم تحويل فاتورة شراء ' || purchase_record.purchase_number || ' - ' || purchase_record.supplier_name,
        purchase_record.transfer_cost,
        purchase_record.supplier_name,
        purchase_record.purchase_number || '-TRANSFER',
        'approved',
        current_user_id
      );
    END IF;
    
    RAISE NOTICE 'تم إضافة مصاريف فاتورة رقم 2';
  END IF;
END $$;