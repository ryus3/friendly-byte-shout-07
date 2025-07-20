-- إصلاح القاصة الرئيسية والحسابات
DO $$
DECLARE
  main_cash_source_id UUID;
  initial_capital NUMERIC := 15000000; -- 15 مليون
  realized_profits NUMERIC := 21000; -- 21 ألف
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية';
  
  -- تحديث القاصة الرئيسية برأس المال الصحيح
  UPDATE public.cash_sources 
  SET 
    initial_balance = initial_capital,
    current_balance = (
      initial_balance + 
      COALESCE(SUM(
        CASE 
          WHEN cm.movement_type = 'in' THEN cm.amount
          WHEN cm.movement_type = 'out' THEN -cm.amount
          ELSE 0
        END
      ), 0)
    ),
    updated_at = now()
  FROM (
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN movement_type = 'in' THEN amount
          WHEN movement_type = 'out' THEN -amount
          ELSE 0
        END
      ), 0) as net_movements
    FROM public.cash_movements 
    WHERE cash_source_id = main_cash_source_id
  ) movements
  WHERE id = main_cash_source_id;
  
  -- إضافة حركة رأس المال إذا لم تكن موجودة
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_movements 
    WHERE cash_source_id = main_cash_source_id 
    AND reference_type = 'initial_capital'
  ) THEN
    INSERT INTO public.cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      main_cash_source_id,
      initial_capital,
      'in',
      'initial_capital',
      gen_random_uuid(),
      'رأس المال الأولي',
      0,
      initial_capital,
      (SELECT user_id FROM public.profiles WHERE is_active = true LIMIT 1)
    );
  END IF;
  
  -- إضافة حركة الأرباح المحققة إذا لم تكن موجودة
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_movements 
    WHERE cash_source_id = main_cash_source_id 
    AND reference_type = 'realized_profit'
  ) THEN
    INSERT INTO public.cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      main_cash_source_id,
      realized_profits,
      'in',
      'realized_profit',
      gen_random_uuid(),
      'صافي الأرباح المحققة',
      initial_capital,
      initial_capital + realized_profits,
      (SELECT user_id FROM public.profiles WHERE is_active = true LIMIT 1)
    );
  END IF;
  
  RAISE NOTICE 'تم إصلاح حسابات القاصة الرئيسية';
END $$;

-- تحديث الرصيد النهائي للقاصة الرئيسية
UPDATE public.cash_sources 
SET current_balance = (
  SELECT 
    initial_balance + 
    COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0)
  FROM public.cash_movements cm
  WHERE cm.cash_source_id = cash_sources.id
)
WHERE name = 'القاصة الرئيسية';