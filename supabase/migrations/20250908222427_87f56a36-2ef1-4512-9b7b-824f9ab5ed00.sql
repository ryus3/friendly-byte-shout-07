-- تصفير قاصة الأعظمية وإصلاح دالة حساب الرصيد الرئيسي

-- 1. العثور على قاصة الأعظمية وتصفيرها
UPDATE public.cash_sources 
SET current_balance = 0, initial_balance = 0, updated_at = now()
WHERE name ILIKE '%اعظم%' OR name ILIKE '%أعظم%';

-- 2. حذف جميع حركات قاصة الأعظمية
DELETE FROM public.cash_movements 
WHERE cash_source_id IN (
  SELECT id FROM public.cash_sources 
  WHERE name ILIKE '%اعظم%' OR name ILIKE '%أعظم%'
);

-- 3. إصلاح دالة حساب الرصيد الرئيسي لتحسب من حركات النقد الفعلية
CREATE OR REPLACE FUNCTION public.calculate_real_main_cash_balance()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  main_cash_source_id uuid;
  calculated_balance numeric := 0;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_source_id
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية'
  AND is_active = true
  LIMIT 1;

  IF main_cash_source_id IS NULL THEN
    RETURN 0;
  END IF;

  -- حساب الرصيد من حركات النقد الفعلية
  SELECT COALESCE(current_balance, 0) INTO calculated_balance
  FROM public.cash_sources
  WHERE id = main_cash_source_id;

  RETURN COALESCE(calculated_balance, 0);
END;
$function$;

-- 4. التأكد من صحة أرصدة مصادر النقد
-- إعادة حساب الأرصدة من حركات النقد لضمان الدقة
UPDATE public.cash_sources 
SET current_balance = (
  SELECT COALESCE(
    initial_balance + COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0), 
    initial_balance
  )
  FROM public.cash_movements cm
  WHERE cm.cash_source_id = cash_sources.id
)
WHERE is_active = true;