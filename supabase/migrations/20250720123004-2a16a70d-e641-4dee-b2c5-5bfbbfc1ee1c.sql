-- تحديث الرصيد الابتدائي للقاصة الرئيسية ليطابق رأس المال الحالي
UPDATE public.cash_sources 
SET 
  initial_balance = (
    SELECT COALESCE(value::numeric, 0) 
    FROM public.settings 
    WHERE key = 'initial_capital'
  ),
  current_balance = (
    SELECT COALESCE(value::numeric, 0) 
    FROM public.settings 
    WHERE key = 'initial_capital'
  ) + COALESCE((
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
  ), 0),
  updated_at = now()
WHERE name = 'القاصة الرئيسية';