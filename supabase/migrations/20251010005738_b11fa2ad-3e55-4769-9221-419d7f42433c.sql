-- ====================================================================
-- إصلاح حساب الإيرادات: استثناء أجور التوصيل من حركات النقد
-- ====================================================================

-- 1️⃣ تحديث الـ trigger ليحسب الإيراد بدون أجور التوصيل
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_source_id uuid;
  v_revenue_amount numeric;
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  -- فقط عند تغيير receipt_received من false إلى true
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN
    
    -- الحصول على القاصة الرئيسية
    SELECT id, current_balance INTO v_cash_source_id, v_balance_before
    FROM public.cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF v_cash_source_id IS NULL THEN
      RAISE NOTICE 'لم يتم العثور على القاصة الرئيسية - تخطي تسجيل الإيراد';
      RETURN NEW;
    END IF;
    
    -- حساب مبلغ الإيراد = المبلغ النهائي - أجور التوصيل
    v_revenue_amount := COALESCE(NEW.final_amount, NEW.total_amount, 0) - COALESCE(NEW.delivery_fee, 0);
    
    -- تخطي إذا كان المبلغ صفر أو سالب
    IF v_revenue_amount <= 0 THEN
      RAISE NOTICE 'مبلغ الإيراد صفر أو سالب (%) - تخطي التسجيل', v_revenue_amount;
      RETURN NEW;
    END IF;
    
    v_balance_after := v_balance_before + v_revenue_amount;
    
    -- تسجيل حركة النقد
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
      v_cash_source_id,
      'in',
      v_revenue_amount,
      v_balance_before,
      v_balance_after,
      'order',
      NEW.id,
      'إيراد بيع طلب ' || COALESCE(NEW.order_number, NEW.tracking_number, NEW.id::text),
      COALESCE(NEW.receipt_received_by, NEW.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
      NOW()
    );
    
    RAISE NOTICE 'تم تسجيل إيراد % للطلب %', v_revenue_amount, COALESCE(NEW.order_number, NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2️⃣ إصلاح حركة النقد للطلب 106246427
WITH order_info AS (
  SELECT id, final_amount, delivery_fee
  FROM public.orders
  WHERE tracking_number = '106246427'
),
movement_info AS (
  SELECT cm.id, cm.balance_before, cm.cash_source_id
  FROM public.cash_movements cm
  JOIN order_info o ON cm.reference_id = o.id
  WHERE cm.reference_type = 'order'
)
UPDATE public.cash_movements cm
SET 
  amount = 15000,
  balance_after = mi.balance_before + 15000,
  description = 'إيراد بيع طلب 106246427 (مُصحح)'
FROM movement_info mi
WHERE cm.id = mi.id;

-- 3️⃣ تحديث رصيد القاصة الرئيسية (تخفيض 5000)
UPDATE public.cash_sources
SET current_balance = current_balance - 5000,
    updated_at = NOW()
WHERE name = 'القاصة الرئيسية';

-- تأكيد النتائج
DO $$
DECLARE
  v_movement_amount numeric;
  v_cash_balance numeric;
BEGIN
  -- التحقق من حركة النقد
  SELECT amount INTO v_movement_amount
  FROM public.cash_movements cm
  JOIN public.orders o ON cm.reference_id = o.id
  WHERE o.tracking_number = '106246427'
    AND cm.reference_type = 'order';
  
  -- التحقق من رصيد القاصة
  SELECT current_balance INTO v_cash_balance
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية';
  
  RAISE NOTICE '✅ حركة النقد للطلب 106246427: %', v_movement_amount;
  RAISE NOTICE '✅ رصيد القاصة الرئيسية: %', v_cash_balance;
END $$;