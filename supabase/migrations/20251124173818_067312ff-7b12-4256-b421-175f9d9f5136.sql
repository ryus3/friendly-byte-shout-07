-- تحديث الدالة مع reference_id كـ UUID
DROP FUNCTION IF EXISTS fix_incorrect_cash_movements();

CREATE OR REPLACE FUNCTION fix_incorrect_cash_movements()
RETURNS TABLE (
  deleted_count integer,
  recreated_count integer,
  final_balance numeric
) AS $$
DECLARE
  main_cash_id uuid;
  deleted integer := 0;
  recreated integer := 0;
  final_bal numeric;
BEGIN
  -- حذف الحركات الخاطئة اليوم
  WITH deleted_rows AS (
    DELETE FROM cash_movements 
    WHERE id IN (
      SELECT cm.id
      FROM cash_movements cm
      JOIN orders o ON cm.reference_id = o.id
      WHERE cm.reference_type = 'order'
        AND cm.movement_type = 'in'
        AND DATE(cm.created_at) = '2025-11-24'
        AND cm.amount = o.final_amount
        AND o.delivery_fee > 0
    )
    RETURNING *
  )
  SELECT COUNT(*)::integer INTO deleted FROM deleted_rows;

  -- احصل على ID القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;

  -- إعادة إنشاء الحركات الصحيحة
  WITH inserted_rows AS (
    INSERT INTO cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      created_by,
      effective_at,
      created_at,
      balance_before,
      balance_after
    )
    SELECT 
      main_cash_id,
      o.final_amount - COALESCE(o.delivery_fee, 0),
      'in',
      'order',
      o.id, -- UUID بدون casting
      'إيراد بيع طلب ' || COALESCE(o.tracking_number, o.order_number),
      COALESCE(o.receipt_received_by, o.created_by),
      o.receipt_received_at,
      o.receipt_received_at,
      0,
      0
    FROM orders o
    WHERE o.receipt_received = true
      AND DATE(o.receipt_received_at) = '2025-11-24'
      AND NOT EXISTS (
        SELECT 1 FROM cash_movements cm
        WHERE cm.reference_id = o.id
          AND cm.reference_type = 'order'
          AND cm.movement_type = 'in'
      )
    RETURNING *
  )
  SELECT COUNT(*)::integer INTO recreated FROM inserted_rows;

  -- إعادة حساب جميع الأرصدة
  WITH ordered_movements AS (
    SELECT 
      id,
      cash_source_id,
      movement_type,
      amount,
      effective_at,
      created_at
    FROM cash_movements
    ORDER BY effective_at ASC, created_at ASC, id ASC
  ),
  running_balance AS (
    SELECT 
      id,
      cash_source_id,
      SUM(
        CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
      ) OVER (
        PARTITION BY cash_source_id 
        ORDER BY effective_at ASC, created_at ASC, id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as balance_after,
      SUM(
        CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
      ) OVER (
        PARTITION BY cash_source_id 
        ORDER BY effective_at ASC, created_at ASC, id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) as balance_before
    FROM ordered_movements
  )
  UPDATE cash_movements cm
  SET 
    balance_after = COALESCE(rb.balance_after, 0),
    balance_before = COALESCE(rb.balance_before, 0)
  FROM running_balance rb
  WHERE cm.id = rb.id;

  -- تحديث رصيد القاصة الرئيسية
  UPDATE cash_sources
  SET 
    current_balance = (
      SELECT COALESCE(balance_after, 0)
      FROM cash_movements 
      WHERE cash_source_id = cash_sources.id
      ORDER BY effective_at DESC, created_at DESC, id DESC
      LIMIT 1
    ),
    updated_at = now()
  WHERE name = 'القاصة الرئيسية'
  RETURNING current_balance INTO final_bal;

  RETURN QUERY SELECT deleted, recreated, COALESCE(final_bal, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;