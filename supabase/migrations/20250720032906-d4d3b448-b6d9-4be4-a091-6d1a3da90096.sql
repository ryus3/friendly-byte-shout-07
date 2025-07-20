-- إنشاء وظيفة حذف شاملة للفواتير مع كل متعلقاتها
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  purchase_record RECORD;
  item_record RECORD;
  affected_rows INTEGER := 0;
  result_data jsonb := '{}';
BEGIN
  -- الحصول على تفاصيل الفاتورة أولاً
  SELECT * INTO purchase_record
  FROM public.purchases
  WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الفاتورة غير موجودة'
    );
  END IF;
  
  RAISE NOTICE 'بدء حذف فاتورة رقم: %', purchase_record.purchase_number;
  
  -- 1. استرداد المبلغ للمصدر النقدي إذا كان محدد
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
    SELECT 
      pi.*,
      pv.barcode,
      pv.sku
    FROM public.purchase_items pi
    LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    -- تقليل المخزون
    UPDATE public.inventory 
    SET 
      quantity = GREATEST(0, quantity - item_record.quantity),
      updated_at = now()
    WHERE product_id = item_record.product_id 
    AND variant_id = item_record.variant_id;
    
    RAISE NOTICE 'تم تقليل مخزون المنتج: % بكمية: %', 
      COALESCE(item_record.barcode, item_record.sku, 'غير محدد'), 
      item_record.quantity;
  END LOOP;
  
  -- 3. حذف المصاريف المرتبطة بالفاتورة
  DELETE FROM public.expenses 
  WHERE receipt_number = purchase_record.purchase_number
     OR receipt_number = purchase_record.purchase_number || '-SHIP'
     OR receipt_number = purchase_record.purchase_number || '-TRANSFER';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % مصروف مرتبط بالفاتورة', affected_rows;
  
  -- 4. حذف المعاملات المالية المرتبطة
  DELETE FROM public.financial_transactions 
  WHERE reference_id = p_purchase_id 
  AND reference_type = 'purchase';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % معاملة مالية', affected_rows;
  
  -- 5. حذف عناصر الفاتورة
  DELETE FROM public.purchase_items 
  WHERE purchase_id = p_purchase_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % عنصر من الفاتورة', affected_rows;
  
  -- 6. حذف الفاتورة نفسها
  DELETE FROM public.purchases 
  WHERE id = p_purchase_id;
  
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'خطأ في حذف الفاتورة: ' || SQLERRM
    );
END;
$$;