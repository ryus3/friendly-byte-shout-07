-- تنظيف مصاريف التوصيل المضاعفة لطلبات الوسيط (مرة واحدة)
DO $$
DECLARE
  cleanup_count INTEGER := 0;
  cash_adjustments NUMERIC := 0;
  main_cash_id UUID;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  IF main_cash_id IS NULL THEN
    RAISE NOTICE 'تحذير: لم يتم العثور على القاصة الرئيسية';
    RETURN;
  END IF;
  
  -- حذف مصاريف التوصيل المضاعفة لطلبات Al-Waseet
  WITH deleted_expenses AS (
    DELETE FROM expenses 
    WHERE category = 'توصيل'
    AND expense_type = 'system'
    AND receipt_number IN (
      SELECT DISTINCT o.order_number
      FROM orders o 
      WHERE o.delivery_partner = 'alwaseet'
      AND o.order_number IS NOT NULL
    )
    RETURNING amount
  )
  SELECT COALESCE(SUM(amount), 0) INTO cash_adjustments FROM deleted_expenses;
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- حذف الحركات النقدية المرتبطة لطلبات Al-Waseet
  DELETE FROM cash_movements 
  WHERE reference_type = 'delivery_cost'
  AND reference_id IN (
    SELECT DISTINCT o.id
    FROM orders o 
    WHERE o.delivery_partner = 'alwaseet'
  );
  
  -- تحديث رصيد القاصة الرئيسية (إضافة المبلغ المحذوف)
  IF cash_adjustments > 0 THEN
    UPDATE cash_sources 
    SET current_balance = current_balance + cash_adjustments,
        updated_at = now()
    WHERE id = main_cash_id;
    
    -- تسجيل حركة تصحيحية
    INSERT INTO cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      description,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      main_cash_id,
      cash_adjustments,
      'in',
      'cleanup_adjustment',
      'تصحيح: إلغاء مصاريف التوصيل المضاعفة لطلبات الوسيط - عدد المصاريف المحذوفة: ' || cleanup_count,
      (SELECT current_balance - cash_adjustments FROM cash_sources WHERE id = main_cash_id),
      (SELECT current_balance FROM cash_sources WHERE id = main_cash_id),
      '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    );
  END IF;
  
  RAISE NOTICE 'تم تنظيف % مصروف توصيل مضاعف لطلبات الوسيط بقيمة إجمالية % د.ع', cleanup_count, cash_adjustments;
END $$;