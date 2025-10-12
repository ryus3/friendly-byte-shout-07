-- إصلاح شامل لتزامن رصيد القاصة النقدية

-- 1. Function لإعادة حساب الرصيد من الحركات
CREATE OR REPLACE FUNCTION recalculate_cash_source_balance(p_source_id UUID)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_initial_balance NUMERIC;
  v_movements_net NUMERIC;
  v_correct_balance NUMERIC;
BEGIN
  -- الرصيد الأولي
  SELECT initial_balance INTO v_initial_balance
  FROM cash_sources
  WHERE id = p_source_id;
  
  -- صافي الحركات (الداخل - الخارج)
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'in' THEN amount
      WHEN movement_type = 'out' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_movements_net
  FROM cash_movements
  WHERE cash_source_id = p_source_id;
  
  -- الرصيد الصحيح = الأولي + صافي الحركات
  v_correct_balance := v_initial_balance + v_movements_net;
  
  -- تحديث الرصيد
  UPDATE cash_sources
  SET current_balance = v_correct_balance,
      updated_at = now()
  WHERE id = p_source_id;
  
  RAISE NOTICE 'تم تصحيح رصيد القاصة %: من % إلى %', p_source_id, 
    (SELECT current_balance FROM cash_sources WHERE id = p_source_id),
    v_correct_balance;
  
  RETURN v_correct_balance;
END;
$$;

-- 2. تنفيذ الإصلاح فوراً على القاصة الرئيسية
DO $$
DECLARE
  v_main_cash_id UUID;
  v_corrected_balance NUMERIC;
BEGIN
  -- الحصول على ID القاصة الرئيسية
  SELECT id INTO v_main_cash_id
  FROM cash_sources
  WHERE name = 'القاصة الرئيسية'
  LIMIT 1;
  
  IF v_main_cash_id IS NOT NULL THEN
    -- تصحيح الرصيد
    v_corrected_balance := recalculate_cash_source_balance(v_main_cash_id);
    RAISE NOTICE 'تم تصحيح رصيد القاصة الرئيسية إلى: %', v_corrected_balance;
  ELSE
    RAISE WARNING 'لم يتم العثور على القاصة الرئيسية';
  END IF;
END;
$$;

-- 3. Trigger للتحقق من سلامة الرصيد بعد كل حركة
CREATE OR REPLACE FUNCTION verify_cash_balance_integrity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_calculated_balance NUMERIC;
  v_current_balance NUMERIC;
  v_source_id UUID;
BEGIN
  -- تحديد معرف المصدر
  v_source_id := COALESCE(NEW.cash_source_id, OLD.cash_source_id);
  
  IF v_source_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- إعادة حساب الرصيد من الحركات
  v_calculated_balance := recalculate_cash_source_balance(v_source_id);
  
  -- الحصول على الرصيد الحالي
  SELECT current_balance INTO v_current_balance
  FROM cash_sources
  WHERE id = v_source_id;
  
  -- التحقق من التطابق
  IF ABS(v_current_balance - v_calculated_balance) > 0.01 THEN
    RAISE WARNING 'تم اكتشاف اختلاف في رصيد القاصة %. تم التصحيح تلقائياً من % إلى %',
      v_source_id, v_current_balance, v_calculated_balance;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- حذف الـ trigger القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS verify_cash_balance_after_movement ON cash_movements;

-- إنشاء trigger جديد يعمل بعد كل عملية إضافة/تحديث/حذف
CREATE TRIGGER verify_cash_balance_after_movement
  AFTER INSERT OR UPDATE OR DELETE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION verify_cash_balance_integrity();

COMMENT ON FUNCTION recalculate_cash_source_balance(UUID) IS 
  'إعادة حساب رصيد القاصة من الرصيد الأولي وجميع الحركات';
  
COMMENT ON FUNCTION verify_cash_balance_integrity() IS 
  'التحقق من سلامة رصيد القاصة وتصحيحه تلقائياً عند اكتشاف اختلاف';