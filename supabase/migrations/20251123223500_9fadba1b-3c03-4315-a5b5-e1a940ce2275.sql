-- =====================================
-- إعادة بناء أرصدة حركات النقد بالترتيب الموحد
-- =====================================
-- الهدف: توحيد الترتيب في كل مكان (effective_at, created_at, id)
-- وإعادة حساب balance_before و balance_after بدقة 100%

-- 1. تصفير جميع الأرصدة
UPDATE cash_movements 
SET balance_before = 0, balance_after = 0;

-- 2. إعادة حساب الأرصدة بالترتيب الموحد الجديد
DO $$
DECLARE
  movement RECORD;
  running_balance NUMERIC := 0;
BEGIN
  FOR movement IN 
    SELECT id, amount, movement_type
    FROM cash_movements
    WHERE cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية')
    ORDER BY effective_at, created_at, id  -- ترتيب موحد deterministic
  LOOP
    UPDATE cash_movements
    SET 
      balance_before = running_balance,
      balance_after = running_balance + 
        CASE WHEN movement.movement_type = 'in' 
        THEN movement.amount 
        ELSE -movement.amount 
        END
    WHERE id = movement.id;
    
    running_balance := running_balance + 
      CASE WHEN movement.movement_type = 'in' 
      THEN movement.amount 
      ELSE -movement.amount 
      END;
  END LOOP;
  
  -- 3. تحديث current_balance في cash_sources ليطابق balance_after الأخير
  UPDATE cash_sources
  SET current_balance = running_balance
  WHERE name = 'القاصة الرئيسية';
  
  -- 4. رفع إشعار بالنجاح
  RAISE NOTICE 'تم إعادة بناء الأرصدة بنجاح - الرصيد النهائي: %', running_balance;
END $$;

-- 5. التحقق النهائي من الأرصدة
DO $$
DECLARE
  expected_balance NUMERIC;
  actual_final_balance NUMERIC;
BEGIN
  SELECT current_balance INTO expected_balance
  FROM cash_sources 
  WHERE name = 'القاصة الرئيسية';
  
  SELECT balance_after INTO actual_final_balance
  FROM cash_movements 
  WHERE cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية')
  ORDER BY effective_at DESC, created_at DESC, id DESC 
  LIMIT 1;
  
  IF expected_balance = actual_final_balance THEN
    RAISE NOTICE '✅ التحقق ناجح - الرصيد المتوقع (%) يطابق الرصيد الفعلي النهائي (%)', expected_balance, actual_final_balance;
  ELSE
    RAISE WARNING '❌ عدم تطابق! الرصيد المتوقع: % ، الرصيد الفعلي: %', expected_balance, actual_final_balance;
  END IF;
END $$;