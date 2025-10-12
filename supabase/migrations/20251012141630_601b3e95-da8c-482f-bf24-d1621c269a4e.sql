-- ============================================
-- إضافة trigger لتسجيل حركة النقد عند استلام الإرجاع (حالة 17)
-- ============================================

-- 1. دالة لتسجيل حركة النقد والمحاسبة عند استلام الإرجاع
CREATE OR REPLACE FUNCTION public.handle_return_delivery_status_17()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_main_cash_id uuid;
  v_main_cash_balance numeric;
  v_refund_amount numeric;
  v_customer_name text;
BEGIN
  -- فقط عند تحديث delivery_status إلى 17 لطلب إرجاع
  IF NEW.delivery_status = '17' 
     AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17')
     AND NEW.order_type = 'return' 
     AND NEW.refund_amount > 0 THEN
    
    -- جلب القاصة الرئيسية
    SELECT id, current_balance INTO v_main_cash_id, v_main_cash_balance
    FROM public.cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF v_main_cash_id IS NULL THEN
      RAISE NOTICE 'تحذير: لم يتم العثور على القاصة الرئيسية للطلب %', NEW.order_number;
      RETURN NEW;
    END IF;
    
    v_refund_amount := NEW.refund_amount;
    v_customer_name := COALESCE(NEW.customer_name, 'غير محدد');
    
    -- ✅ 1. تسجيل حركة نقد خارجة (out) من القاصة
    INSERT INTO public.cash_movements (
      cash_source_id,
      movement_type,
      amount,
      balance_before,
      balance_after,
      reference_type,
      reference_id,
      description,
      created_by,
      effective_at
    ) VALUES (
      v_main_cash_id,
      'out',
      v_refund_amount,
      v_main_cash_balance,
      v_main_cash_balance - v_refund_amount,
      'order_refund',
      NEW.id,
      format('إرجاع مبلغ %s IQD للزبون %s - طلب #%s', 
        to_char(v_refund_amount, 'FM999,999,999'), 
        v_customer_name,
        COALESCE(NEW.order_number, NEW.id::text)
      ),
      COALESCE(NEW.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
      now()
    );
    
    -- ✅ 2. تسجيل في accounting كخصم من فاتورة الوسيط
    INSERT INTO public.accounting (
      type,
      category,
      amount,
      description,
      reference_type,
      reference_id,
      payment_method,
      created_by,
      transaction_date
    ) VALUES (
      'expense',
      'delivery_refund_deduction',
      v_refund_amount,
      format('خصم من فاتورة الوسيط - إرجاع طلب #%s - المبلغ المدفوع للزبون: %s IQD',
        COALESCE(NEW.order_number, NEW.id::text),
        to_char(v_refund_amount, 'FM999,999,999')
      ),
      'order',
      NEW.id,
      'delivery_invoice_deduction',
      COALESCE(NEW.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
      now()
    );
    
    -- ✅ 3. تحديث ملاحظات الطلب
    NEW.notes := COALESCE(NEW.notes || E'\n\n', '') || 
                 format('✅ [%s] تم استلام الإرجاع من الزبون ودفع %s IQD - سيتم خصمه من فاتورة الوسيط',
                   to_char(now(), 'YYYY-MM-DD HH24:MI'),
                   to_char(v_refund_amount, 'FM999,999,999')
                 );
    
    RAISE NOTICE 'تم تسجيل حركة نقد للإرجاع - الطلب: %, المبلغ: %', 
      COALESCE(NEW.order_number, NEW.id::text), v_refund_amount;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. إنشاء trigger
DROP TRIGGER IF EXISTS trigger_handle_return_status_17 ON public.orders;

CREATE TRIGGER trigger_handle_return_status_17
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_return_delivery_status_17();

-- 3. تعليق توضيحي
COMMENT ON FUNCTION public.handle_return_delivery_status_17() IS 
'تسجيل تلقائي لحركة النقد والمحاسبة عند استلام طلب الإرجاع (delivery_status = 17)';

COMMENT ON TRIGGER trigger_handle_return_status_17 ON public.orders IS
'يُفعّل عند تحديث delivery_status إلى 17 لطلب إرجاع - يسجل حركة نقد خارجة وخصم من فاتورة الوسيط';