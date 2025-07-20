-- إصلاح دالة حذف الفاتورة لحل مشكلة الالتباس في أسماء الأعمدة
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  purchase_record RECORD;
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
  
  -- 1. تقليل كمية المخزون للمنتجات التي تم شراؤها (إصلاح الالتباس)
  UPDATE public.inventory 
  SET quantity = GREATEST(0, inventory.quantity - pi.quantity),
      updated_at = now()
  FROM public.purchase_items pi
  WHERE inventory.product_id = pi.product_id 
    AND inventory.variant_id = pi.variant_id
    AND pi.purchase_id = p_purchase_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  result_data := jsonb_set(result_data, '{inventory_updated}', to_jsonb(affected_rows));
  
  -- 2. حذف المصاريف المرتبطة بالفاتورة (البضاعة + الشحن + التحويل)
  DELETE FROM public.expenses 
  WHERE receipt_number IN (
    purchase_record.purchase_number,
    purchase_record.purchase_number || '-SHIP',
    purchase_record.purchase_number || '-TRANSFER'
  );
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  result_data := jsonb_set(result_data, '{expenses_deleted}', to_jsonb(affected_rows));
  
  -- 3. حذف المعاملات المالية المرتبطة
  DELETE FROM public.financial_transactions
  WHERE reference_type = 'purchase' AND reference_id = p_purchase_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  result_data := jsonb_set(result_data, '{transactions_deleted}', to_jsonb(affected_rows));
  
  -- 4. حذف عناصر الفاتورة
  DELETE FROM public.purchase_items
  WHERE purchase_id = p_purchase_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  result_data := jsonb_set(result_data, '{items_deleted}', to_jsonb(affected_rows));
  
  -- 5. حذف الفاتورة نفسها
  DELETE FROM public.purchases
  WHERE id = p_purchase_id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  result_data := jsonb_set(result_data, '{purchase_deleted}', to_jsonb(affected_rows));
  
  -- 6. إضافة معلومات الفاتورة المحذوفة للنتيجة
  result_data := jsonb_set(result_data, '{deleted_purchase}', to_jsonb(purchase_record.purchase_number));
  result_data := jsonb_set(result_data, '{success}', 'true');
  
  RETURN result_data;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE
  );
END;
$function$;