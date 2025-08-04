-- حذف جميع دوال حساب الرصيد الأخرى والاحتفاظ بدالة واحدة موحدة
-- إزالة الدوال المكررة والمشوشة

-- حذف الدوال القديمة
DROP FUNCTION IF EXISTS public.calculate_main_cash_balance();
DROP FUNCTION IF EXISTS public.calculate_main_cash_balance_v2();
DROP FUNCTION IF EXISTS public.calculate_main_cash_balance_v3();
DROP FUNCTION IF EXISTS public.calculate_enhanced_main_cash_balance_v2();
DROP FUNCTION IF EXISTS public.calculate_enhanced_main_cash_balance_v3();
DROP FUNCTION IF EXISTS public.calculate_enhanced_main_cash_balance_v5();

-- إنشاء دالة مبسطة تستدعي الدالة الموحدة
CREATE OR REPLACE FUNCTION public.calculate_main_cash_balance()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_data record;
BEGIN
  -- استخدام الدالة الموحدة الوحيدة
  SELECT * INTO result_data FROM calculate_enhanced_main_cash_balance();
  RETURN result_data.final_balance;
END;
$$;

-- تحديث دالة تحديث الرصيد لتستخدم الدالة الموحدة
CREATE OR REPLACE FUNCTION public.refresh_main_cash_balance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id UUID;
  new_balance NUMERIC;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id 
  FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NOT NULL THEN
    -- حساب الرصيد الجديد باستخدام الدالة الموحدة
    SELECT public.calculate_main_cash_balance() INTO new_balance;
    
    -- تحديث الرصيد
    UPDATE public.cash_sources 
    SET current_balance = new_balance, updated_at = now()
    WHERE id = main_cash_id;
  END IF;
END;
$$;

-- إضافة تعليق للدالة الموحدة
COMMENT ON FUNCTION public.calculate_enhanced_main_cash_balance() IS 'الدالة الموحدة الوحيدة لحساب رصيد القاصة الرئيسية - النظام الموحد';
COMMENT ON FUNCTION public.calculate_main_cash_balance() IS 'دالة مبسطة تستدعي النظام الموحد';

-- رسالة تأكيد
DO $$
BEGIN
  RAISE NOTICE 'تم توحيد نظام حساب الرصيد بنجاح - دالة واحدة موحدة فقط';
END $$;