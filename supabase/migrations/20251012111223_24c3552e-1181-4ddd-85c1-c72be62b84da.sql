-- =====================================================
-- المرحلة 1: تنظيف النظام الحالي
-- =====================================================

-- 1.1 حذف جميع حركات النقد المرتبطة بمصاريف الفواتير
DELETE FROM cash_movements 
WHERE reference_type = 'expense' 
AND reference_id IN (
  SELECT id FROM expenses 
  WHERE metadata->>'purchase_reference_id' IS NOT NULL
);

-- 1.2 حذف جميع حركات "إرجاع المصروف" الخاطئة
DELETE FROM cash_movements 
WHERE reference_type = 'expense_refund';

-- 1.3 حذف جميع المصاريف المرتبطة بالفواتير
DELETE FROM expenses 
WHERE metadata->>'purchase_reference_id' IS NOT NULL;

-- =====================================================
-- المرحلة 2: حذف Triggers القديمة أولاً
-- =====================================================

DROP TRIGGER IF EXISTS on_expense_approved_create_movement ON expenses;
DROP TRIGGER IF EXISTS trigger_create_cash_movement_for_expense ON expenses;
DROP FUNCTION IF EXISTS create_cash_movement_for_expense() CASCADE;

-- =====================================================
-- المرحلة 3: إنشاء Trigger لحركة النقد الموحدة
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_purchase_cash_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- جلب الرصيد الحالي قبل الخصم
  SELECT current_balance INTO v_balance_before 
  FROM cash_sources 
  WHERE id = NEW.cash_source_id
  FOR UPDATE; -- قفل لمنع التعارض
  
  -- حساب الرصيد الجديد
  v_balance_after := v_balance_before - NEW.total_amount;
  
  -- إنشاء حركة نقد واحدة فقط
  INSERT INTO cash_movements (
    cash_source_id,
    movement_type,
    amount,
    description,
    reference_type,
    reference_id,
    balance_before,
    balance_after,
    created_by,
    effective_at
  ) VALUES (
    NEW.cash_source_id,
    'out',
    NEW.total_amount,
    'شراء بضاعة - فاتورة ' || COALESCE(NEW.supplier_name, 'غير محدد'),
    'purchase',
    NEW.id,
    v_balance_before,
    v_balance_after,
    NEW.user_id,
    NEW.purchase_date
  );
  
  -- تحديث رصيد القاصة
  UPDATE cash_sources 
  SET current_balance = v_balance_after,
      updated_at = now()
  WHERE id = NEW.cash_source_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ربط Trigger بجدول purchases
DROP TRIGGER IF EXISTS on_purchase_insert_create_movement ON purchases;
CREATE TRIGGER on_purchase_insert_create_movement
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_purchase_cash_movement();

-- =====================================================
-- المرحلة 4: تحديث Function حذف الفاتورة
-- =====================================================

CREATE OR REPLACE FUNCTION delete_purchase_completely(p_purchase_id UUID)
RETURNS jsonb AS $$
DECLARE
  purchase_record RECORD;
  v_deleted_movements INT := 0;
BEGIN
  -- جلب بيانات الفاتورة
  SELECT * INTO purchase_record FROM purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  -- حذف حركة النقد الواحدة المرتبطة بالفاتورة مباشرة
  DELETE FROM cash_movements 
  WHERE reference_type = 'purchase' 
    AND reference_id = p_purchase_id;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;
  
  -- إرجاع الرصيد
  UPDATE cash_sources 
  SET current_balance = current_balance + purchase_record.total_amount,
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
    'refunded_amount', purchase_record.total_amount,
    'message', 'تم حذف الفاتورة وإرجاع ' || purchase_record.total_amount || ' د.ع للقاصة'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =====================================================
-- المرحلة 5: Function لإعادة حساب جميع الأرصدة
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_all_cash_movements()
RETURNS void AS $$
DECLARE
  movement_rec RECORD;
  running_balance NUMERIC;
  source_rec RECORD;
BEGIN
  -- لكل مصدر نقد
  FOR source_rec IN SELECT id, initial_balance FROM cash_sources ORDER BY id LOOP
    running_balance := source_rec.initial_balance;
    
    -- ترتيب الحركات حسب التاريخ
    FOR movement_rec IN 
      SELECT id, movement_type, amount
      FROM cash_movements 
      WHERE cash_source_id = source_rec.id
      ORDER BY effective_at ASC, created_at ASC
    LOOP
      -- تحديث balance_before
      UPDATE cash_movements 
      SET balance_before = running_balance
      WHERE id = movement_rec.id;
      
      -- حساب الرصيد الجديد
      IF movement_rec.movement_type = 'in' THEN
        running_balance := running_balance + movement_rec.amount;
      ELSE
        running_balance := running_balance - movement_rec.amount;
      END IF;
      
      -- تحديث balance_after
      UPDATE cash_movements 
      SET balance_after = running_balance
      WHERE id = movement_rec.id;
    END LOOP;
    
    -- التحقق من تطابق الرصيد النهائي
    UPDATE cash_sources 
    SET current_balance = running_balance,
        updated_at = now()
    WHERE id = source_rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تنفيذ إعادة الحساب
SELECT recalculate_all_cash_movements();