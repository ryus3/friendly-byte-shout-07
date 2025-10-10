-- ====================================================================
-- إصلاح تطابق الرصيد النقدي + آليات الحماية المستقبلية
-- ====================================================================

-- 1️⃣ إعادة مزامنة رصيد القاصة الرئيسية من آخر حركة نقد (5,215,000)
UPDATE public.cash_sources cs
SET 
  current_balance = (
    SELECT cm.balance_after
    FROM public.cash_movements cm
    WHERE cm.cash_source_id = cs.id
    ORDER BY cm.effective_at DESC, cm.created_at DESC
    LIMIT 1
  ),
  updated_at = NOW()
WHERE cs.name = 'القاصة الرئيسية';

-- 2️⃣ إنشاء دالة للتحقق من التطابق بين الرصيد والحركات
CREATE OR REPLACE FUNCTION public.validate_cash_balance_sync()
RETURNS TABLE(
  source_name text,
  current_balance numeric,
  last_movement_balance numeric,
  difference numeric,
  is_synced boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.name::text,
    cs.current_balance,
    COALESCE(
      (
        SELECT cm.balance_after
        FROM public.cash_movements cm
        WHERE cm.cash_source_id = cs.id
        ORDER BY cm.effective_at DESC, cm.created_at DESC
        LIMIT 1
      ),
      cs.initial_balance
    ) as last_balance,
    cs.current_balance - COALESCE(
      (
        SELECT cm.balance_after
        FROM public.cash_movements cm
        WHERE cm.cash_source_id = cs.id
        ORDER BY cm.effective_at DESC, cm.created_at DESC
        LIMIT 1
      ),
      cs.initial_balance
    ) as diff,
    cs.current_balance = COALESCE(
      (
        SELECT cm.balance_after
        FROM public.cash_movements cm
        WHERE cm.cash_source_id = cs.id
        ORDER BY cm.effective_at DESC, cm.created_at DESC
        LIMIT 1
      ),
      cs.initial_balance
    ) as synced
  FROM public.cash_sources cs
  WHERE cs.is_active = true
  ORDER BY cs.name;
END;
$$;

-- 3️⃣ التحقق من النتائج
DO $$
DECLARE
  v_main_cash_balance numeric;
  v_last_movement_balance numeric;
  v_difference numeric;
BEGIN
  -- الحصول على رصيد القاصة الرئيسية
  SELECT current_balance INTO v_main_cash_balance
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية';
  
  -- الحصول على آخر رصيد من الحركات
  SELECT balance_after INTO v_last_movement_balance
  FROM public.cash_movements cm
  JOIN public.cash_sources cs ON cm.cash_source_id = cs.id
  WHERE cs.name = 'القاصة الرئيسية'
  ORDER BY cm.effective_at DESC, cm.created_at DESC
  LIMIT 1;
  
  v_difference := v_main_cash_balance - v_last_movement_balance;
  
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅ رصيد القاصة الرئيسية: %', v_main_cash_balance;
  RAISE NOTICE '✅ آخر رصيد بالحركات: %', v_last_movement_balance;
  RAISE NOTICE '✅ الفرق: % (يجب أن يكون صفر)', v_difference;
  
  IF v_difference = 0 THEN
    RAISE NOTICE '🎉 تطابق تام! النظام يعمل بشكل صحيح';
  ELSE
    RAISE WARNING '⚠️ يوجد اختلاف بمقدار %', v_difference;
  END IF;
  RAISE NOTICE '════════════════════════════════════════';
END $$;