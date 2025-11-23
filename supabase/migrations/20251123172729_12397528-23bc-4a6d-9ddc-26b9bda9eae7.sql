-- =====================================================
-- الخطة الكاملة: إصلاح حركات النقد والأرصدة
-- =====================================================

-- المرحلة 1: حذف جميع الحركات المكررة بدقة تامة
-- =====================================================
-- نحذف المكرر، نحتفظ فقط بأقدم حركة لكل طلب
WITH duplicate_movements AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id, movement_type
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM cash_movements
  WHERE reference_type = 'order'
)
DELETE FROM cash_movements
WHERE id IN (
  SELECT id FROM duplicate_movements WHERE row_num > 1
);

-- المرحلة 2: إعادة حساب الأرصدة لجميع الحركات
-- =====================================================
WITH ordered_movements AS (
  SELECT 
    id,
    cash_source_id,
    SUM(
      CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
    ) OVER (
      PARTITION BY cash_source_id 
      ORDER BY effective_at, created_at
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as correct_balance
  FROM cash_movements
)
UPDATE cash_movements cm
SET balance_after = om.correct_balance
FROM ordered_movements om
WHERE cm.id = om.id;

-- المرحلة 3: تصحيح رصيد القاصة الرئيسية
-- =====================================================
UPDATE cash_sources
SET 
  current_balance = (
    SELECT COALESCE(balance_after, 0)
    FROM cash_movements 
    WHERE cash_source_id = cash_sources.id
    ORDER BY effective_at DESC, created_at DESC 
    LIMIT 1
  ),
  updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- المرحلة 4: إصلاح Trigger المسبب للتكرار
-- =====================================================
DROP TRIGGER IF EXISTS record_order_revenue_on_receipt ON orders;
DROP FUNCTION IF EXISTS record_order_revenue_on_receipt() CASCADE;

CREATE OR REPLACE FUNCTION record_order_revenue_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  movement_exists boolean;
BEGIN
  -- فقط عند تحديث receipt_received إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    -- ✅ إصلاح: التحقق من movement_type = 'in' وليس 'income'
    SELECT EXISTS(
      SELECT 1 FROM cash_movements 
      WHERE reference_type = 'order' 
        AND reference_id = NEW.id
        AND movement_type = 'in'
    ) INTO movement_exists;
    
    IF movement_exists THEN
      RETURN NEW; -- حماية: لا تُنشئ حركة مكررة
    END IF;
    
    SELECT id INTO main_cash_source_id
    FROM cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF main_cash_source_id IS NOT NULL THEN
      -- استخدام RPC بدلاً من INSERT مباشر
      PERFORM update_cash_source_balance(
        main_cash_source_id,
        NEW.final_amount,
        'in',
        'order',
        NEW.id,
        'إيراد بيع طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
        COALESCE(NEW.receipt_received_by, NEW.created_by)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER record_order_revenue_on_receipt
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_revenue_on_receipt();

-- المرحلة 5: منع التكرار المستقبلي
-- =====================================================
-- إضافة UNIQUE INDEX لمنع التكرار على مستوى Database
DROP INDEX IF EXISTS idx_unique_order_cash_movement;
CREATE UNIQUE INDEX idx_unique_order_cash_movement
ON cash_movements (reference_id, movement_type)
WHERE reference_type = 'order';

-- إضافة تعليق توثيقي
COMMENT ON INDEX idx_unique_order_cash_movement IS 'يمنع إنشاء حركات نقد مكررة لنفس الطلب';