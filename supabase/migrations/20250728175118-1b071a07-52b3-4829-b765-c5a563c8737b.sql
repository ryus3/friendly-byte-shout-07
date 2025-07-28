-- إنشاء دالة لتسجيل دفع مستحقات الموظفين
CREATE OR REPLACE FUNCTION public.pay_employee_dues(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT '',
  p_paid_by UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id UUID;
  employee_name TEXT;
  result_data jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- الحصول على اسم الموظف
  SELECT full_name INTO employee_name FROM profiles WHERE user_id = p_employee_id;
  
  IF main_cash_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'القاصة الرئيسية غير موجودة');
  END IF;
  
  IF employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الموظف غير موجود');
  END IF;
  
  -- تسجيل الحركة النقدية لدفع المستحقات
  PERFORM public.update_cash_source_balance(
    main_cash_id,
    p_amount,
    'out',
    'employee_dues',
    p_employee_id,
    COALESCE(p_description, 'دفع مستحقات الموظف ' || employee_name),
    COALESCE(p_paid_by, auth.uid())
  );
  
  -- إضافة مصروف من نوع نظام
  INSERT INTO expenses (
    category,
    expense_type,
    description,
    amount,
    status,
    created_by,
    approved_by,
    approved_at,
    metadata
  ) VALUES (
    'مستحقات الموظفين',
    'system',
    'دفع مستحقات الموظف ' || employee_name || ' - ' || COALESCE(p_description, ''),
    p_amount,
    'approved',
    COALESCE(p_paid_by, auth.uid()),
    COALESCE(p_paid_by, auth.uid()),
    now(),
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', employee_name,
      'payment_date', now(),
      'payment_type', 'employee_dues'
    )
  );
  
  -- تحديث حالة الأرباح إلى مدفوعة
  UPDATE profits 
  SET status = 'settled',
      settled_at = now(),
      settled_by = COALESCE(p_paid_by, auth.uid())
  WHERE employee_id = p_employee_id 
  AND status = 'pending';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || employee_name || ' بنجاح',
    'amount', p_amount,
    'employee_name', employee_name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;