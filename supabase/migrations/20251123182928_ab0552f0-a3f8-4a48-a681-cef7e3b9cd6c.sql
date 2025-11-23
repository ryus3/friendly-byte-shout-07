-- =====================================================
-- الخطة الكاملة: إصلاح حركات النقد والأرصدة النهائية
-- =====================================================
-- الرصيد النهائي المتوقع: 1,168,000 د.ع
-- (1,182,000 مبيعات بدون توصيل - 14,000 مستحقات موظفين)
-- =====================================================

-- المرحلة 1: حذف الحركات الخاطئة السبعة المحددة
-- =====================================================
DELETE FROM cash_movements 
WHERE id IN (
  '54382177-175f-4a8c-8e6e-79317d591811', -- مصروف محلي محذوف ORD000001
  '38043b6f-eb42-4935-a520-78477cee97c4', -- مصروف محلي محذوف ORD000002
  'f848def2-b611-4709-b94c-120a26bf5cb9', -- رسوم توصيل محذوفة ORD000002
  '47007e78-aa5f-4c43-8166-997d86b7c0b2', -- رسوم توصيل محذوفة ORD000001
  '8315afcd-81c7-44c4-9517-673a3b460426', -- إرجاع مصروف محذوف ORD000002
  '0651ebc1-00fe-42bb-b6f9-9553b94e37af', -- إرجاع مصروف محذوف ORD000001
  'b53acf65-5093-4571-9347-8673b4099a72'  -- تحديث رأس المال الوهمي (0 د.ع)
);

-- المرحلة 2: إعادة حساب الأرصدة لجميع الحركات حسب التاريخ
-- =====================================================
WITH ordered_movements AS (
  SELECT 
    id,
    cash_source_id,
    SUM(
      CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
    ) OVER (
      PARTITION BY cash_source_id 
      ORDER BY effective_at ASC, created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as correct_balance
  FROM cash_movements
)
UPDATE cash_movements cm
SET 
  balance_after = om.correct_balance,
  balance_before = om.correct_balance - 
    CASE WHEN cm.movement_type = 'in' THEN cm.amount ELSE -cm.amount END
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
    
    -- ✅ التحقق من وجود حركة نقد مسبقاً (movement_type = 'in')
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
      -- استخدام RPC لإضافة الحركة بشكل آمن
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

-- المرحلة 5: منع التكرار المستقبلي على مستوى Database
-- =====================================================
DROP INDEX IF EXISTS idx_unique_order_cash_movement;
CREATE UNIQUE INDEX idx_unique_order_cash_movement
ON cash_movements (reference_id, movement_type)
WHERE reference_type = 'order';

COMMENT ON INDEX idx_unique_order_cash_movement IS 'يمنع إنشاء حركات نقد مكررة لنفس الطلب - كل طلب = حركة واحدة فقط';