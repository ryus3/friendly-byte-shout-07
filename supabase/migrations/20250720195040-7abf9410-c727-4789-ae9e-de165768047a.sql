-- حذف إعداد capital والاعتماد على initial_capital فقط
DELETE FROM public.settings WHERE key = 'capital';

-- تحديث دالة calculate_net_capital لتستخدم initial_capital فقط
CREATE OR REPLACE FUNCTION public.calculate_net_capital()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_capital NUMERIC := 0;
  total_injections NUMERIC := 0;
  total_withdrawals NUMERIC := 0;
  net_capital NUMERIC := 0;
BEGIN
  -- الحصول على رأس المال الأساسي من initial_capital فقط
  SELECT COALESCE(value::numeric, 0) INTO base_capital
  FROM public.settings 
  WHERE key = 'initial_capital';
  
  -- حساب إجمالي الحقن الرأسمالية
  SELECT COALESCE(SUM(amount), 0) INTO total_injections
  FROM public.cash_movements
  WHERE reference_type = 'capital_injection';
  
  -- حساب إجمالي السحوبات الرأسمالية
  SELECT COALESCE(SUM(amount), 0) INTO total_withdrawals
  FROM public.cash_movements
  WHERE reference_type = 'capital_withdrawal';
  
  -- حساب صافي رأس المال
  net_capital := base_capital + total_injections - total_withdrawals;
  
  -- التأكد من عدم النزول تحت الصفر
  RETURN GREATEST(net_capital, 0);
END;
$$;

-- تحديث رصيد القاصة الرئيسية بناءً على initial_capital + جميع الحركات
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