-- إصلاح جذري: تحديث دالة حذف الفاتورة + تنظيف الاسترداد المضاعف

-- 1. أولاً: حذف الاسترداد المضاعف للمصروف
DELETE FROM public.cash_movements 
WHERE id = '70487526-31a9-403f-98b4-87fb638592f0'
AND reference_type = 'expense_refund'
AND description = 'استرداد مصروف محذوف: شراء منتجات - فاتورة رقم 1 من تجريبي';

-- 2. تصحيح رصيد القاصة الرئيسية (إزالة الاسترداد الزائد)
UPDATE public.cash_sources 
SET current_balance = 5042000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 3. تحديث دالة حذف الفاتورة لتتعامل مع كل شيء بدقة
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  purchase_record RECORD;
  item_record RECORD;
  expense_record RECORD;
  affected_rows INTEGER := 0;
  result_data jsonb := '{}';
BEGIN
  -- الحصول على تفاصيل الفاتورة أولاً
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  RAISE NOTICE 'بدء حذف فاتورة رقم: %', purchase_record.purchase_number;
  
  -- 1. استرداد المبلغ للمصدر النقدي إذا كان محدد (مرة واحدة فقط)
  IF purchase_record.cash_source_id IS NOT NULL THEN
    PERFORM public.update_cash_source_balance(
      purchase_record.cash_source_id, 
      purchase_record.total_amount, 
      'in', 
      'purchase_refund',
      p_purchase_id, 
      'استرداد مبلغ فاتورة محذوفة رقم ' || purchase_record.purchase_number,
      purchase_record.created_by
    );
    RAISE NOTICE 'تم استرداد المبلغ: % للمصدر النقدي', purchase_record.total_amount;
  END IF;
  
  -- 2. تقليل كمية المخزون للعناصر
  FOR item_record IN 
    SELECT pi.*, pv.barcode, pv.sku
    FROM public.purchase_items pi
    LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    UPDATE public.inventory 
    SET quantity = GREATEST(0, quantity - item_record.quantity), 
        updated_at = now()
    WHERE product_id = item_record.product_id 
    AND variant_id = item_record.variant_id;
    
    RAISE NOTICE 'تم تقليل مخزون المنتج: % بكمية: %', 
      COALESCE(item_record.barcode, item_record.sku, 'غير محدد'), item_record.quantity;
  END LOOP;
  
  -- 3. حذف وإرجاع المصاريف المرتبطة بالفاتورة مع الاسترداد المالي
  FOR expense_record IN 
    SELECT * FROM public.expenses 
    WHERE receipt_number = purchase_record.purchase_number
       OR receipt_number = purchase_record.purchase_number || '-SHIP'
       OR receipt_number = purchase_record.purchase_number || '-TRANSFER'
  LOOP
    -- استرداد مبلغ المصروف للقاصة الرئيسية إذا كان معتمد
    IF expense_record.status = 'approved' THEN
      DECLARE
        main_cash_source_id uuid;
      BEGIN
        SELECT id INTO main_cash_source_id 
        FROM public.cash_sources 
        WHERE name = 'القاصة الرئيسية' AND is_active = true
        LIMIT 1;
        
        IF main_cash_source_id IS NOT NULL THEN
          PERFORM public.update_cash_source_balance(
            main_cash_source_id,
            expense_record.amount,
            'in',
            'expense_refund',
            expense_record.id,
            'استرداد مصروف محذوف: ' || expense_record.description,
            expense_record.created_by
          );
          RAISE NOTICE 'تم استرداد مصروف: % بمبلغ: %', expense_record.description, expense_record.amount;
        END IF;
      END;
    END IF;
    
    -- حذف المصروف
    DELETE FROM public.expenses WHERE id = expense_record.id;
  END LOOP;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % مصروف مرتبط بالفاتورة', affected_rows;
  
  -- 4. حذف سجلات التكلفة المرتبطة بالفاتورة
  DELETE FROM public.purchase_cost_history WHERE purchase_id = p_purchase_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % سجل تكلفة', affected_rows;
  
  -- 5. حذف المعاملات المالية المرتبطة
  DELETE FROM public.financial_transactions 
  WHERE reference_id = p_purchase_id AND reference_type = 'purchase';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % معاملة مالية', affected_rows;
  
  -- 6. حذف عناصر الفاتورة
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % عنصر من الفاتورة', affected_rows;
  
  -- 7. حذف الفاتورة نفسها
  DELETE FROM public.purchases WHERE id = p_purchase_id;
  
  RAISE NOTICE 'تم حذف الفاتورة رقم: % نهائياً', purchase_record.purchase_number;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف الفاتورة رقم ' || purchase_record.purchase_number || ' وجميع متعلقاتها بنجاح',
    'purchase_number', purchase_record.purchase_number,
    'refunded_amount', purchase_record.total_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في حذف الفاتورة: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'خطأ في حذف الفاتورة: ' || SQLERRM);
END;
$function$;