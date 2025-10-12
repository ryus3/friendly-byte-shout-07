-- =====================================================
-- المرحلة 1: تنظيف البيانات الخاطئة
-- =====================================================

-- 1.1 حذف جميع حركات "إرجاع المصروف" الخاطئة
DELETE FROM cash_movements 
WHERE reference_type = 'expense_refund'
AND created_at >= '2025-10-11';

-- 1.2 تصحيح رصيد القاصة الرئيسية
UPDATE cash_sources 
SET current_balance = 5202000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- =====================================================
-- المرحلة 2: إصلاح Function حذف الفاتورة
-- =====================================================

CREATE OR REPLACE FUNCTION delete_purchase_completely(p_purchase_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  purchase_record RECORD;
  v_expense_id UUID;
  v_deleted_movements INT := 0;
  v_deleted_expenses INT := 0;
BEGIN
  -- جلب بيانات الفاتورة
  SELECT * INTO purchase_record FROM purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  -- حذف حركات النقد المرتبطة بالمصاريف مباشرة (بدون "إرجاع")
  FOR v_expense_id IN 
    SELECT id FROM expenses 
    WHERE (metadata->>'purchase_reference_id')::UUID = p_purchase_id
  LOOP
    DELETE FROM cash_movements 
    WHERE reference_type = 'expense' AND reference_id = v_expense_id;
    GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;
  END LOOP;
  
  -- حذف المصاريف
  DELETE FROM expenses 
  WHERE (metadata->>'purchase_reference_id')::UUID = p_purchase_id;
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;
  
  -- إرجاع الرصيد بناءً على المبلغ الفعلي المدفوع
  UPDATE cash_sources 
  SET current_balance = current_balance + COALESCE(purchase_record.paid_amount, 0),
      updated_at = now()
  WHERE id = purchase_record.cash_source_id;
  
  -- تحديث المخزون (إرجاع الكميات)
  UPDATE inventory i
  SET quantity = GREATEST(0, i.quantity - pi.quantity),
      updated_at = now()
  FROM purchase_items pi
  WHERE pi.purchase_id = p_purchase_id 
    AND i.variant_id = pi.variant_id;
  
  -- حذف السجلات المرتبطة
  DELETE FROM purchase_cost_history WHERE purchase_id = p_purchase_id;
  DELETE FROM purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM purchases WHERE id = p_purchase_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'deleted_movements', v_deleted_movements,
    'deleted_expenses', v_deleted_expenses,
    'refunded_amount', COALESCE(purchase_record.paid_amount, 0),
    'message', 'تم حذف الفاتورة وإرجاع ' || COALESCE(purchase_record.paid_amount, 0) || ' د.ع للقاصة'
  );
END;
$$;