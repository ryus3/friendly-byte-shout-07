-- Fix the function to avoid ambiguous column reference
DROP FUNCTION IF EXISTS public.update_cash_source_balance;

CREATE OR REPLACE FUNCTION public.update_cash_source_balance(
    p_cash_source_id UUID,
    p_amount NUMERIC,
    p_movement_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT,
    p_created_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    old_balance NUMERIC;
    new_balance NUMERIC;
    movement_id UUID;
    source_name TEXT;
BEGIN
    -- Get current balance and source name
    SELECT cs.current_balance, cs.name INTO old_balance, source_name
    FROM public.cash_sources cs
    WHERE cs.id = p_cash_source_id AND cs.is_active = true;
    
    IF old_balance IS NULL THEN
        RAISE EXCEPTION 'مصدر النقد غير موجود أو غير نشط';
    END IF;
    
    -- Calculate new balance
    IF p_movement_type = 'in' THEN
        new_balance := old_balance + p_amount;
    ELSIF p_movement_type = 'out' THEN
        new_balance := old_balance - p_amount;
        
        -- Check for sufficient balance (except for main cash register with capital withdrawals)
        IF new_balance < 0 AND NOT (source_name = 'القاصة الرئيسية' AND p_reference_type = 'capital_withdrawal') THEN
            RAISE EXCEPTION 'رصيد غير كافي للسحب. الرصيد الحالي: %', old_balance;
        END IF;
    ELSE
        RAISE EXCEPTION 'نوع الحركة غير صحيح. يجب أن يكون in أو out';
    END IF;
    
    -- Update cash source balance
    UPDATE public.cash_sources 
    SET current_balance = new_balance, updated_at = now()
    WHERE id = p_cash_source_id;
    
    -- Insert movement record
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
        old_balance,
        new_balance,
        p_created_by
    ) RETURNING id INTO movement_id;
    
    RETURN json_build_object(
        'success', true,
        'movement_id', movement_id,
        'old_balance', old_balance,
        'new_balance', new_balance,
        'amount', p_amount,
        'type', p_movement_type
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;