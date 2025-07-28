-- حذف الدالة القديمة وإنشاء دالة محسنة
DROP FUNCTION IF EXISTS public.update_cash_source_balance(uuid,numeric,text,text,uuid,text,uuid);

-- إنشاء دالة جديدة محسنة
CREATE OR REPLACE FUNCTION public.update_cash_source_balance(
  p_cash_source_id UUID,
  p_amount NUMERIC,
  p_movement_type TEXT, -- 'in' or 'out'
  p_reference_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
  movement_id UUID;
BEGIN
  -- الحصول على الرصيد الحالي
  SELECT cs.current_balance INTO current_balance 
  FROM cash_sources cs 
  WHERE cs.id = p_cash_source_id;
  
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'مصدر النقد غير موجود');
  END IF;
  
  -- حساب الرصيد الجديد
  IF p_movement_type = 'in' THEN
    new_balance := current_balance + p_amount;
  ELSIF p_movement_type = 'out' THEN
    new_balance := current_balance - p_amount;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'نوع الحركة غير صحيح');
  END IF;
  
  -- تحديث رصيد المصدر
  UPDATE cash_sources 
  SET current_balance = new_balance, updated_at = now()
  WHERE id = p_cash_source_id;
  
  -- إدراج حركة نقدية
  INSERT INTO cash_movements (
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
    current_balance,
    new_balance,
    COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO movement_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'movement_id', movement_id,
    'old_balance', current_balance,
    'new_balance', new_balance,
    'amount', p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;