-- تنظيف نهائي صحيح: حذف triggers أولاً ثم الدوال

-- 1. حذف جميع triggers المضاعفة أولاً
DROP TRIGGER IF EXISTS trigger_process_expense_cash_movement ON public.expenses;
DROP TRIGGER IF EXISTS process_expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS trigger_handle_expense_cash_flow ON public.expenses;
DROP TRIGGER IF EXISTS handle_purchase_cash_flow_trigger ON public.purchases;
DROP TRIGGER IF EXISTS purchase_cash_flow_trigger ON public.purchases;

-- 2. حذف جميع الدوال المسببة للتكرار
DROP FUNCTION IF EXISTS public.process_expense_cash_movement();
DROP FUNCTION IF EXISTS public.handle_expense_cash_flow();
DROP FUNCTION IF EXISTS public.handle_purchase_cash_flow() CASCADE;

-- 3. حذف جميع الحركات المالية المضاعفة والخاطئة للفاتورة رقم 1
DELETE FROM public.cash_movements 
WHERE (description LIKE '%فاتورة رقم 1%' OR description LIKE '%فاتورة 1%') 
AND id != 'ec8c7213-1598-4471-88c3-2f2f5b3c1def';

-- 4. حذف جميع المصاريف المضاعفة للفاتورة رقم 1 
DELETE FROM public.expenses 
WHERE receipt_number IN ('1', '1-SHIP', '1-TRANSFER') 
OR description LIKE '%فاتورة رقم 1%';

-- 5. إعادة ضبط رصيد القاصة الرئيسية للقيمة الصحيحة
UPDATE public.cash_sources 
SET current_balance = 5042000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 6. تحديث دالة حذف الفاتورة (نظيفة بدون triggers)
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  purchase_record RECORD;
  item_record RECORD;
BEGIN
  -- الحصول على تفاصيل الفاتورة
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  -- 1. استرداد مبلغ الفاتورة مرة واحدة فقط
  IF purchase_record.cash_source_id IS NOT NULL THEN
    PERFORM public.update_cash_source_balance(
      purchase_record.cash_source_id, 
      purchase_record.total_amount, 
      'in', 
      'purchase_refund',
      p_purchase_id, 
      'استرداد فاتورة محذوفة رقم ' || purchase_record.purchase_number,
      purchase_record.created_by
    );
  END IF;
  
  -- 2. تقليل المخزون
  FOR item_record IN 
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    UPDATE public.inventory 
    SET quantity = GREATEST(0, quantity - item_record.quantity), 
        updated_at = now()
    WHERE product_id = item_record.product_id 
    AND variant_id = item_record.variant_id;
  END LOOP;
  
  -- 3. حذف البيانات المرتبطة
  DELETE FROM public.purchase_cost_history WHERE purchase_id = p_purchase_id;
  DELETE FROM public.financial_transactions WHERE reference_id = p_purchase_id;
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  
  -- 4. حذف المصاريف المرتبطة يدوياً
  DELETE FROM public.expenses 
  WHERE receipt_number = purchase_record.purchase_number
     OR receipt_number = purchase_record.purchase_number || '-SHIP'
     OR receipt_number = purchase_record.purchase_number || '-TRANSFER';
  
  -- 5. حذف الفاتورة
  DELETE FROM public.purchases WHERE id = p_purchase_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف الفاتورة ' || purchase_record.purchase_number || ' نهائياً',
    'purchase_number', purchase_record.purchase_number
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;