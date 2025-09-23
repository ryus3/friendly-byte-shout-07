-- إصلاح مزامنة النقد: تحديث آخر حركة نقد لتتطابق مع رصيد القاصة الرئيسية
UPDATE cash_movements 
SET balance_after = 5200000
WHERE cash_source_id = (
  SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية'
)
AND created_at = (
  SELECT MAX(created_at) 
  FROM cash_movements cm2 
  WHERE cm2.cash_source_id = cash_movements.cash_source_id
);

-- إنشاء دالة مزامنة النقد التلقائية
CREATE OR REPLACE FUNCTION public.sync_cash_balance_with_movements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- تحديث رصيد مصدر النقد بناءً على آخر حركة
  UPDATE cash_sources 
  SET current_balance = NEW.balance_after,
      updated_at = now()
  WHERE id = NEW.cash_source_id;
  
  RETURN NEW;
END;
$function$;

-- ربط الدالة بجدول حركات النقد
DROP TRIGGER IF EXISTS sync_cash_balance_trigger ON cash_movements;
CREATE TRIGGER sync_cash_balance_trigger
  AFTER INSERT OR UPDATE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION sync_cash_balance_with_movements();