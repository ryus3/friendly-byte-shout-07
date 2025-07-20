-- إضافة مصادر نقد افتراضية إذا لم تكن موجودة
DO $$
DECLARE
  main_cash_id UUID;
  bank_account_id UUID;
  admin_user_id UUID;
BEGIN
  -- الحصول على أول مستخدم مدير
  SELECT p.user_id INTO admin_user_id FROM public.profiles p WHERE p.is_active = true ORDER BY p.created_at LIMIT 1;
  
  -- التحقق من وجود القاصة الرئيسية
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;
  
  -- إنشاء القاصة الرئيسية إذا لم تكن موجودة
  IF main_cash_id IS NULL THEN
    INSERT INTO public.cash_sources (
      name, 
      type, 
      description, 
      current_balance, 
      initial_balance,
      created_by
    ) VALUES (
      'القاصة الرئيسية',
      'cash',
      'القاصة النقدية الرئيسية للمتجر',
      0,
      0,
      admin_user_id
    ) RETURNING id INTO main_cash_id;
    
    RAISE NOTICE 'تم إنشاء القاصة الرئيسية';
  END IF;
  
  -- التحقق من وجود حساب بنكي افتراضي
  SELECT id INTO bank_account_id FROM public.cash_sources WHERE name = 'الحساب البنكي الرئيسي' LIMIT 1;
  
  -- إنشاء حساب بنكي افتراضي إذا لم يكن موجود
  IF bank_account_id IS NULL THEN
    INSERT INTO public.cash_sources (
      name, 
      type, 
      description, 
      current_balance, 
      initial_balance,
      created_by
    ) VALUES (
      'الحساب البنكي الرئيسي',
      'bank',
      'الحساب البنكي الرئيسي للمتجر',
      0,
      0,
      admin_user_id
    ) RETURNING id INTO bank_account_id;
    
    RAISE NOTICE 'تم إنشاء الحساب البنكي الرئيسي';
  END IF;
  
END $$;

-- إضافة دالة للحصول على مصدر النقد الافتراضي
CREATE OR REPLACE FUNCTION public.get_default_cash_source()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_source_id UUID;
BEGIN
  -- البحث عن القاصة الرئيسية أولاً
  SELECT id INTO default_source_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true
  LIMIT 1;
  
  -- إذا لم توجد، أخذ أول مصدر نشط
  IF default_source_id IS NULL THEN
    SELECT id INTO default_source_id 
    FROM public.cash_sources 
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;
  
  RETURN default_source_id;
END;
$$;

-- إضافة دالة لحساب صافي رأس المال من القاصة
CREATE OR REPLACE FUNCTION public.calculate_net_capital()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_capital NUMERIC := 0;
  total_withdrawals NUMERIC := 0;
  net_capital NUMERIC := 0;
BEGIN
  -- حساب إجمالي رؤوس الأموال المضافة
  SELECT COALESCE(SUM(amount), 0) INTO total_capital
  FROM public.cash_movements 
  WHERE movement_type = 'in' 
  AND reference_type = 'capital_injection';
  
  -- حساب إجمالي السحوبات من رأس المال
  SELECT COALESCE(SUM(amount), 0) INTO total_withdrawals
  FROM public.cash_movements 
  WHERE movement_type = 'out' 
  AND reference_type = 'capital_withdrawal';
  
  net_capital := total_capital - total_withdrawals;
  
  RETURN GREATEST(net_capital, 0);
END;
$$;

-- إضافة دالة للحصول على إجمالي رصيد جميع مصادر النقد
CREATE OR REPLACE FUNCTION public.get_total_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_balance NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(current_balance), 0) INTO total_balance
  FROM public.cash_sources 
  WHERE is_active = true;
  
  RETURN total_balance;
END;
$$;