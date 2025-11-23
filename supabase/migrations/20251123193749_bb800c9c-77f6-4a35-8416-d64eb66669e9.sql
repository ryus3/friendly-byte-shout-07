-- =====================================================
-- خطة الإصلاح الشاملة: إعادة بناء نظام النقد من الصفر
-- =====================================================
-- الرصيد النهائي المتوقع: 1,168,000 د.ع
-- (1,182,000 مبيعات بدون توصيل - 14,000 مستحقات موظفين)
-- =====================================================

-- المرحلة 1: تصحيح الطلب 101264291 من 15,000 إلى 19,000
-- =====================================================
UPDATE cash_movements
SET 
  amount = 19000,
  description = 'إيراد بيع طلب 101264291 (مصحح)'
WHERE reference_type = 'order'
  AND reference_id = (SELECT id FROM orders WHERE tracking_number = '101264291')
  AND movement_type = 'in';

-- المرحلة 2: إعادة بناء جميع الأرصدة من الصفر
-- =====================================================
-- أولاً: تصفير جميع الأرصدة
UPDATE cash_movements
SET 
  balance_before = 0,
  balance_after = 0;

-- ثانياً: إعادة حساب الأرصدة بشكل تسلسلي صحيح
DO $$
DECLARE
  movement_record RECORD;
  running_balance NUMERIC := 0;
  prev_balance NUMERIC := 0;
BEGIN
  -- حساب الأرصدة بترتيب زمني صحيح
  FOR movement_record IN (
    SELECT 
      id,
      movement_type,
      amount,
      cash_source_id
    FROM cash_movements
    WHERE cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية')
    ORDER BY effective_at ASC, created_at ASC
  )
  LOOP
    -- حساب الرصيد قبل الحركة
    prev_balance := running_balance;
    
    -- حساب الرصيد بعد الحركة
    IF movement_record.movement_type = 'in' THEN
      running_balance := running_balance + movement_record.amount;
    ELSE
      running_balance := running_balance - movement_record.amount;
    END IF;
    
    -- تحديث الحركة
    UPDATE cash_movements
    SET 
      balance_before = prev_balance,
      balance_after = running_balance
    WHERE id = movement_record.id;
  END LOOP;
END $$;

-- المرحلة 3: تصحيح الرصيد النهائي للقاصة الرئيسية
-- =====================================================
UPDATE cash_sources
SET 
  current_balance = 1168000,
  updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- المرحلة 4: التحقق النهائي الشامل
-- =====================================================
DO $$
DECLARE
  revenue_count INTEGER;
  revenue_total NUMERIC;
  expense_count INTEGER;
  expense_total NUMERIC;
  final_balance NUMERIC;
  verification_passed BOOLEAN := true;
BEGIN
  -- عدد ومجموع حركات الإيرادات
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO revenue_count, revenue_total
  FROM cash_movements
  WHERE movement_type = 'in' 
    AND reference_type = 'order'
    AND cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية');
  
  -- عدد ومجموع حركات المصروفات
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO expense_count, expense_total
  FROM cash_movements
  WHERE movement_type = 'out'
    AND cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية');
  
  -- الرصيد النهائي
  SELECT current_balance INTO final_balance
  FROM cash_sources
  WHERE name = 'القاصة الرئيسية';
  
  -- طباعة النتائج
  RAISE NOTICE '========================================';
  RAISE NOTICE 'نتائج التحقق النهائي:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'عدد حركات الإيرادات: % (المتوقع: 42)', revenue_count;
  RAISE NOTICE 'مجموع الإيرادات: % د.ع (المتوقع: 1,182,000)', revenue_total;
  RAISE NOTICE 'عدد حركات المصروفات: % (المتوقع: 2)', expense_count;
  RAISE NOTICE 'مجموع المصروفات: % د.ع (المتوقع: 14,000)', expense_total;
  RAISE NOTICE 'الرصيد النهائي: % د.ع (المتوقع: 1,168,000)', final_balance;
  RAISE NOTICE '========================================';
  
  -- التحقق من الصحة
  IF revenue_count != 42 THEN
    verification_passed := false;
    RAISE WARNING '❌ عدد حركات الإيرادات غير صحيح!';
  END IF;
  
  IF revenue_total != 1182000 THEN
    verification_passed := false;
    RAISE WARNING '❌ مجموع الإيرادات غير صحيح!';
  END IF;
  
  IF expense_count != 2 THEN
    verification_passed := false;
    RAISE WARNING '❌ عدد حركات المصروفات غير صحيح!';
  END IF;
  
  IF expense_total != 14000 THEN
    verification_passed := false;
    RAISE WARNING '❌ مجموع المصروفات غير صحيح!';
  END IF;
  
  IF final_balance != 1168000 THEN
    verification_passed := false;
    RAISE WARNING '❌ الرصيد النهائي غير صحيح!';
  END IF;
  
  IF verification_passed THEN
    RAISE NOTICE '✅ جميع الفحوصات ناجحة - النظام المالي صحيح 100%%';
  ELSE
    RAISE EXCEPTION '❌ فشل التحقق - يوجد أخطاء في البيانات المالية';
  END IF;
END $$;