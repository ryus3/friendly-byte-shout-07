-- حذف الـ function القديم وإعادة إنشاؤه
DROP FUNCTION IF EXISTS public.update_cash_source_balance(uuid,numeric,text,text,uuid,text,uuid);

-- إعادة إنشاء function update_cash_source_balance بنوع إرجاع صحيح
CREATE OR REPLACE FUNCTION public.update_cash_source_balance(
  p_cash_source_id UUID,
  p_amount NUMERIC,
  p_movement_type TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT,
  p_created_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_movement_id UUID;
  v_cash_source_name TEXT;
BEGIN
  -- الحصول على الرصيد الحالي واسم المصدر
  SELECT cs.current_balance, cs.name 
  INTO v_current_balance, v_cash_source_name
  FROM public.cash_sources cs
  WHERE cs.id = p_cash_source_id AND cs.is_active = true;
  
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'مصدر النقد غير موجود أو غير نشط';
  END IF;
  
  -- حساب الرصيد الجديد
  IF p_movement_type = 'in' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_movement_type = 'out' THEN
    v_new_balance := v_current_balance - p_amount;
    -- التحقق من كفاية الرصيد للسحب (إلا للقاصة الرئيسية في حالة سحب رأس المال)
    IF v_new_balance < 0 AND NOT (v_cash_source_name = 'القاصة الرئيسية' AND p_reference_type = 'capital_withdrawal') THEN
      RAISE EXCEPTION 'الرصيد غير كافي. الرصيد الحالي: %, المطلوب سحبه: %', v_current_balance, p_amount;
    END IF;
  ELSE
    RAISE EXCEPTION 'نوع الحركة غير صحيح: %', p_movement_type;
  END IF;
  
  -- تحديث رصيد مصدر النقد
  UPDATE public.cash_sources 
  SET current_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_cash_source_id;
  
  -- إدراج حركة النقد
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
    p_cash_source_id,
    p_amount,
    p_movement_type,
    p_reference_type,
    p_reference_id,
    p_description,
    v_current_balance,
    v_new_balance,
    p_created_by
  ) RETURNING id INTO v_movement_id;
  
  RETURN json_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_movement_type
  );
END;
$$;