-- تحديث trigger لتسجيل المبلغ الكامل في المحاسبة
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
  v_delivery_fee numeric;
  v_total_amount numeric;
  v_customer_name text;
BEGIN
  IF NEW.delivery_status = '17' 
     AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '17')
     AND NEW.order_type = 'return' 
     AND NEW.refund_amount > 0 THEN
    
    SELECT id, current_balance INTO v_main_cash_id, v_main_cash_balance
    FROM public.cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF v_main_cash_id IS NULL THEN
      RAISE NOTICE 'تحذير: لم يتم العثور على القاصة الرئيسية';
      RETURN NEW;
    END IF;
    
    v_refund_amount := NEW.refund_amount;
    v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    v_total_amount := v_refund_amount + v_delivery_fee;
    v_customer_name := COALESCE(NEW.customer_name, 'غير محدد');
    
    -- تسجيل حركة نقد بمبلغ الإرجاع فقط (16,000)
    INSERT INTO public.cash_movements (
      cash_source_id, movement_type, amount,
      balance_before, balance_after,
      reference_type, reference_id, description, created_by, effective_at
    ) VALUES (
      v_main_cash_id, 'out', v_refund_amount,
      v_main_cash_balance, v_main_cash_balance - v_refund_amount,
      'order_refund', NEW.id,
      format('دفع %s IQD للزبون %s - طلب #%s', 
        to_char(v_refund_amount, 'FM999,999,999'), 
        v_customer_name,
        COALESCE(NEW.order_number, NEW.id::text)
      ),
      COALESCE(NEW.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
      now()
    );
    
    -- تسجيل في accounting بالمبلغ الكامل (21,000)
    INSERT INTO public.accounting (
      type, category, amount, description,
      reference_type, reference_id, payment_method, created_by, transaction_date
    ) VALUES (
      'expense', 'delivery_refund_deduction', v_total_amount,
      format('خصم من فاتورة الوسيط - طلب #%s | دفع للزبون: %s IQD + توصيل: %s IQD = %s IQD',
        COALESCE(NEW.order_number, NEW.id::text),
        to_char(v_refund_amount, 'FM999,999,999'),
        to_char(v_delivery_fee, 'FM999,999,999'),
        to_char(v_total_amount, 'FM999,999,999')
      ),
      'order', NEW.id, 'delivery_invoice_deduction',
      COALESCE(NEW.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
      now()
    );
    
    -- تحديث ملاحظات الطلب
    NEW.notes := COALESCE(NEW.notes || E'\n\n', '') || 
      format('✅ [%s] استلام إرجاع | دفع %s للزبون | خصم %s من الوسيط',
        to_char(now(), 'YYYY-MM-DD HH24:MI'),
        to_char(v_refund_amount, 'FM999,999,999'),
        to_char(v_total_amount, 'FM999,999,999')
      );
    
    RAISE NOTICE 'حالة 17: دفع % للزبون، خصم % من الوسيط', v_refund_amount, v_total_amount;
  END IF;
  
  RETURN NEW;
END;
$$;