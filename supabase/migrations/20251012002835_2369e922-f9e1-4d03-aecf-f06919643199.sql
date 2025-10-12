-- Migration مبسطة: حذف Triggers + تنظيف Data + Update Function فقط
-- (الطلب 106246427 سيكتمل تلقائياً بواسطة trigger موجود)

-- 1. حذف Triggers المسببة للتضاعف
DROP TRIGGER IF EXISTS expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS auto_create_expense_cash_movement ON public.expenses;
DROP TRIGGER IF EXISTS trigger_process_expense_cash_movement ON public.expenses;

-- 2. تنظيف cash_movements المكررة
DELETE FROM public.cash_movements 
WHERE reference_type = 'expense'
  AND description LIKE '%فاتورة رقم%'
  AND created_at >= '2024-01-01';

-- 3. إعادة حساب أرصدة مصادر النقد
UPDATE public.cash_sources cs
SET current_balance = (
  SELECT COALESCE(SUM(
    CASE WHEN cm.movement_type = 'in' THEN cm.amount ELSE -cm.amount END
  ), 0) + cs.initial_balance
  FROM public.cash_movements cm
  WHERE cm.cash_source_id = cs.id
),
updated_at = now();

-- 4. تحديث دالة delete_purchase_completely
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  purchase_record RECORD;
  v_deleted_movements INTEGER := 0;
  v_deleted_expenses INTEGER := 0;
  v_deleted_items INTEGER := 0;
BEGIN
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  DELETE FROM public.cash_movements WHERE reference_type = 'purchase' AND reference_id = p_purchase_id;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;
  
  DELETE FROM public.cash_movements WHERE reference_type = 'expense' AND reference_id IN (
    SELECT id FROM public.expenses WHERE receipt_number LIKE purchase_record.purchase_number || '%'
  );
  
  DELETE FROM public.expenses WHERE receipt_number LIKE purchase_record.purchase_number || '%';
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;
  
  IF purchase_record.cash_source_id IS NOT NULL THEN
    UPDATE public.cash_sources SET current_balance = current_balance + purchase_record.total_amount, updated_at = now()
    WHERE id = purchase_record.cash_source_id;
  END IF;
  
  UPDATE public.inventory i SET quantity = GREATEST(0, i.quantity - pi.quantity), updated_at = now()
  FROM public.purchase_items pi WHERE pi.purchase_id = p_purchase_id AND i.variant_id = pi.variant_id;
  
  DELETE FROM public.purchase_cost_history WHERE purchase_id = p_purchase_id;
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;
  DELETE FROM public.purchases WHERE id = p_purchase_id;
  
  RETURN jsonb_build_object(
    'success', true, 'deleted_movements', v_deleted_movements, 'deleted_expenses', v_deleted_expenses,
    'deleted_items', v_deleted_items, 'amount_restored', purchase_record.total_amount,
    'message', 'تم حذف الفاتورة بالكامل مع استرداد ' || purchase_record.total_amount::text || ' د.ع'
  );
END;
$function$;