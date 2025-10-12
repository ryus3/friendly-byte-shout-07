-- إنشاء دالة Trigger لإنشاء حركة مالية تلقائية عند الشراء
CREATE OR REPLACE FUNCTION auto_create_purchase_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- جلب الرصيد الحالي لمصدر النقد
  SELECT current_balance INTO v_current_balance
  FROM cash_sources
  WHERE id = NEW.cash_source_id;

  -- حساب الرصيد بعد الخصم
  v_balance_after := v_current_balance - NEW.paid_amount;

  -- إنشاء حركة مالية واحدة بالإجمالي الكلي
  INSERT INTO cash_movements (
    cash_source_id,
    movement_type,
    amount,
    description,
    reference_type,
    reference_id,
    effective_at,
    balance_before,
    balance_after,
    created_by
  ) VALUES (
    NEW.cash_source_id,
    'out',                                           -- خروج نقد
    NEW.paid_amount,                                 -- الإجمالي الكلي
    'شراء بضاعة - فاتورة رقم ' || COALESCE(NEW.purchase_number, NEW.id::text),
    'purchase',
    NEW.id,
    COALESCE(NEW.purchase_date::timestamp with time zone, NEW.created_at),
    v_current_balance,
    v_balance_after,
    NEW.created_by
  );

  -- تحديث رصيد مصدر النقد
  UPDATE cash_sources
  SET current_balance = v_balance_after,
      updated_at = now()
  WHERE id = NEW.cash_source_id;

  RETURN NEW;
END;
$$;

-- إنشاء Trigger على جدول المشتريات
DROP TRIGGER IF EXISTS trigger_auto_create_purchase_cash_movement ON purchases;
CREATE TRIGGER trigger_auto_create_purchase_cash_movement
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_purchase_cash_movement();

-- إنشاء دالة Trigger لحذف الحركة المالية عند حذف الفاتورة
CREATE OR REPLACE FUNCTION auto_delete_purchase_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- إعادة المبلغ لمصدر النقد
  UPDATE cash_sources
  SET current_balance = current_balance + OLD.paid_amount,
      updated_at = now()
  WHERE id = OLD.cash_source_id;

  -- حذف الحركة المالية المرتبطة
  DELETE FROM cash_movements
  WHERE reference_type = 'purchase'
    AND reference_id = OLD.id;

  RETURN OLD;
END;
$$;

-- إنشاء Trigger للحذف
DROP TRIGGER IF EXISTS trigger_auto_delete_purchase_cash_movement ON purchases;
CREATE TRIGGER trigger_auto_delete_purchase_cash_movement
  BEFORE DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_purchase_cash_movement();

-- إصلاح الفاتورة الحالية: إنشاء الحركة المالية المفقودة
DO $$
DECLARE
  v_purchase_id UUID := '940c0014-a0b8-432d-9b2d-86ebb050d36f';
  v_current_balance NUMERIC;
  v_paid_amount NUMERIC;
  v_cash_source_id UUID;
  v_purchase_number TEXT;
  v_purchase_date TIMESTAMP WITH TIME ZONE;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_created_by UUID;
BEGIN
  -- التحقق من عدم وجود حركة مالية مسبقة
  IF NOT EXISTS (
    SELECT 1 FROM cash_movements 
    WHERE reference_type = 'purchase' 
      AND reference_id = v_purchase_id
  ) THEN
    -- جلب بيانات الفاتورة
    SELECT 
      p.paid_amount,
      p.cash_source_id,
      p.purchase_number,
      p.purchase_date,
      p.created_at,
      p.created_by,
      cs.current_balance
    INTO 
      v_paid_amount,
      v_cash_source_id,
      v_purchase_number,
      v_purchase_date,
      v_created_at,
      v_created_by,
      v_current_balance
    FROM purchases p
    JOIN cash_sources cs ON p.cash_source_id = cs.id
    WHERE p.id = v_purchase_id;

    -- إنشاء الحركة المالية
    INSERT INTO cash_movements (
      cash_source_id,
      movement_type,
      amount,
      description,
      reference_type,
      reference_id,
      effective_at,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      v_cash_source_id,
      'out',
      v_paid_amount,
      'شراء بضاعة - فاتورة رقم ' || COALESCE(v_purchase_number, v_purchase_id::text),
      'purchase',
      v_purchase_id,
      COALESCE(v_purchase_date::timestamp with time zone, v_created_at),
      v_current_balance,
      v_current_balance - v_paid_amount,
      v_created_by
    );

    -- تحديث رصيد مصدر النقد
    UPDATE cash_sources
    SET current_balance = current_balance - v_paid_amount,
        updated_at = now()
    WHERE id = v_cash_source_id;

    RAISE NOTICE 'تم إنشاء حركة مالية للفاتورة % بمبلغ %', v_purchase_number, v_paid_amount;
  ELSE
    RAISE NOTICE 'الحركة المالية موجودة مسبقاً للفاتورة';
  END IF;
END $$;