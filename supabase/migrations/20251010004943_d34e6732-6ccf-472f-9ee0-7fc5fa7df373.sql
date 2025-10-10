-- إصلاح trigger القديم المُسبب للخطأ
DROP FUNCTION IF EXISTS public.record_order_revenue_on_receipt() CASCADE;

-- إعادة إنشاء الـ function بدون الخطأ
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_source_id uuid;
  v_current_balance numeric;
  v_revenue_amount numeric;
BEGIN
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    v_revenue_amount := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    
    IF v_revenue_amount > 0 THEN
      SELECT cs.id, cs.current_balance INTO v_cash_source_id, v_current_balance
      FROM public.cash_sources cs
      WHERE cs.name = 'القاصة الرئيسية'
      LIMIT 1;
      
      IF v_cash_source_id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
          cash_source_id, movement_type, amount, 
          balance_before, balance_after, reference_type, reference_id,
          description, effective_at, created_by
        ) VALUES (
          v_cash_source_id, 'in', v_revenue_amount,
          v_current_balance, v_current_balance + v_revenue_amount,
          'order', NEW.id,
          'إيراد من الطلب ' || COALESCE(NEW.order_number, NEW.id::text),
          NEW.receipt_received_at, NEW.receipt_received_by
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trigger_record_order_revenue_on_receipt ON public.orders;
CREATE TRIGGER trigger_record_order_revenue_on_receipt
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false)
  EXECUTE FUNCTION public.record_order_revenue_on_receipt();