-- إصلاح مشكلة رموز التليغرام والإيرادات المالية

-- 1. إنشاء رمز تليغرام للموظف sara
INSERT INTO public.telegram_employee_codes (user_id, employee_code, is_active)
SELECT 
    'f10d8ed9-24d3-45d6-a310-d45db5a747a0'::uuid,
    'EMP003',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.telegram_employee_codes 
    WHERE user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'::uuid
);

-- 2. تحديث دالة إنشاء المعاملات المالية عند تسوية الأرباح
CREATE OR REPLACE FUNCTION public.record_profit_settlement_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  main_cash_source_id UUID;
  current_balance NUMERIC;
BEGIN
  -- فقط عند تغيير الحالة إلى settled
  IF NEW.status = 'settled' AND COALESCE(OLD.status, '') <> 'settled' THEN
    
    -- الحصول على القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true
    LIMIT 1;
    
    IF main_cash_source_id IS NOT NULL THEN
      -- الحصول على الرصيد الحالي
      SELECT current_balance INTO current_balance 
      FROM public.cash_sources 
      WHERE id = main_cash_source_id;
      
      -- تسجيل معاملة مالية خروج (دفع الربح للموظف)
      INSERT INTO public.financial_transactions (
        transaction_type,
        reference_type,
        reference_id,
        amount,
        description,
        created_by
      ) VALUES (
        'employee_profit_payout',
        'profit_settlement',
        NEW.id,
        -NEW.employee_profit, -- مبلغ سالب لأنه خروج من القاصة
        'دفع ربح الموظف للطلب رقم ' || (
          SELECT COALESCE(order_number, id::text) 
          FROM orders WHERE id = NEW.order_id
        ),
        COALESCE(auth.uid(), NEW.employee_id)
      );
      
      -- تحديث رصيد القاصة
      UPDATE public.cash_sources 
      SET current_balance = current_balance - NEW.employee_profit,
          updated_at = now()
      WHERE id = main_cash_source_id;
      
      RAISE NOTICE 'تم تسجيل معاملة دفع ربح الموظف بمبلغ % للطلب %', NEW.employee_profit, NEW.order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. إنشاء تريغر لتسجيل المعاملات المالية عند تسوية الأرباح
DROP TRIGGER IF EXISTS trigger_profit_settlement_transaction ON public.profits;
CREATE TRIGGER trigger_profit_settlement_transaction
  AFTER UPDATE ON public.profits
  FOR EACH ROW
  EXECUTE FUNCTION public.record_profit_settlement_transaction();

-- 4. تحديث دالة تسجيل إيرادات الطلبات
CREATE OR REPLACE FUNCTION public.record_order_revenue_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  main_cash_source_id UUID;
  current_balance NUMERIC;
BEGIN
  -- عند تغيير حالة استلام الفاتورة إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    -- الحصول على القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true
    LIMIT 1;
    
    IF main_cash_source_id IS NOT NULL THEN
      -- الحصول على الرصيد الحالي
      SELECT current_balance INTO current_balance 
      FROM public.cash_sources 
      WHERE id = main_cash_source_id;
      
      -- تسجيل معاملة مالية دخل (إيراد الطلب)
      INSERT INTO public.financial_transactions (
        transaction_type,
        reference_type,
        reference_id,
        amount,
        description,
        created_by
      ) VALUES (
        'order_revenue',
        'order_completion',
        NEW.id,
        NEW.final_amount, -- مبلغ موجب لأنه دخل للقاصة
        'إيراد الطلب رقم ' || COALESCE(NEW.order_number, NEW.id::text),
        COALESCE(auth.uid(), NEW.created_by)
      );
      
      -- تحديث رصيد القاصة
      UPDATE public.cash_sources 
      SET current_balance = current_balance + NEW.final_amount,
          updated_at = now()
      WHERE id = main_cash_source_id;
      
      RAISE NOTICE 'تم تسجيل إيراد الطلب بمبلغ % للطلب %', NEW.final_amount, COALESCE(NEW.order_number, NEW.id::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. إنشاء تريغر لتسجيل إيرادات الطلبات
DROP TRIGGER IF EXISTS trigger_order_revenue_transaction ON public.orders;
CREATE TRIGGER trigger_order_revenue_transaction
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.record_order_revenue_transaction();

-- 6. معالجة الطلب 101264291 الذي لم يسجل إيراده
DO $$
DECLARE
  v_order_id UUID := 'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a';
  v_order_record RECORD;
  main_cash_source_id UUID;
  current_balance NUMERIC;
BEGIN
  -- الحصول على بيانات الطلب
  SELECT * INTO v_order_record 
  FROM orders 
  WHERE id = v_order_id AND receipt_received = true;
  
  IF v_order_record.id IS NOT NULL THEN
    -- التحقق من عدم وجود معاملة مالية مسبقة لهذا الطلب
    IF NOT EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE reference_type = 'order_completion' 
      AND reference_id = v_order_id
    ) THEN
      
      -- الحصول على القاصة الرئيسية
      SELECT id, current_balance INTO main_cash_source_id, current_balance
      FROM cash_sources 
      WHERE name = 'القاصة الرئيسية' AND is_active = true
      LIMIT 1;
      
      IF main_cash_source_id IS NOT NULL THEN
        -- تسجيل معاملة الإيراد
        INSERT INTO financial_transactions (
          transaction_type,
          reference_type,
          reference_id,
          amount,
          description,
          created_by
        ) VALUES (
          'order_revenue',
          'order_completion',
          v_order_id,
          v_order_record.final_amount,
          'إيراد الطلب رقم ' || COALESCE(v_order_record.order_number, v_order_record.id::text) || ' - معالجة متأخرة',
          v_order_record.created_by
        );
        
        -- تحديث رصيد القاصة
        UPDATE cash_sources 
        SET current_balance = current_balance + v_order_record.final_amount,
            updated_at = now()
        WHERE id = main_cash_source_id;
        
        RAISE NOTICE 'تم تسجيل إيراد الطلب % بمبلغ %', v_order_record.order_number, v_order_record.final_amount;
      END IF;
    ELSE
      RAISE NOTICE 'الطلب % لديه معاملة مالية مسجلة مسبقاً', v_order_record.order_number;
    END IF;
  ELSE
    RAISE NOTICE 'الطلب غير موجود أو لم يتم استلام فاتورته';
  END IF;
END $$;