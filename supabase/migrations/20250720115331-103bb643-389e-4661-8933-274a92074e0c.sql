-- إصلاح مشكلة رأس المال المضاعف
UPDATE public.cash_sources 
SET current_balance = initial_balance + COALESCE((
  SELECT SUM(
    CASE 
      WHEN cm.movement_type = 'in' THEN cm.amount
      WHEN cm.movement_type = 'out' THEN -cm.amount
      ELSE 0
    END
  )
  FROM public.cash_movements cm 
  WHERE cm.cash_source_id = cash_sources.id
  AND cm.reference_type != 'initial_capital'  -- استبعاد رأس المال الابتدائي
), 0)
WHERE name = 'القاصة الرئيسية';