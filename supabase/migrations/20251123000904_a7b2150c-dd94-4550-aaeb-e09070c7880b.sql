-- إنشاء function مؤقتة لتصحيح المبالغ بتجاوز RLS
CREATE OR REPLACE FUNCTION fix_partial_delivery_amounts()
RETURNS TABLE(tracking_number text, new_final_amount numeric, new_total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- تصحيح 112552848
  UPDATE orders 
  SET final_amount = 61000, total_amount = 56000, updated_at = NOW()
  WHERE orders.tracking_number = '112552848';
  
  -- تصحيح 112066293
  UPDATE orders 
  SET final_amount = 33000, total_amount = 28000, updated_at = NOW()
  WHERE orders.tracking_number = '112066293';
  
  -- إرجاع النتائج
  RETURN QUERY
  SELECT 
    o.tracking_number::text,
    o.final_amount,
    o.total_amount
  FROM orders o
  WHERE o.tracking_number IN ('112552848', '112066293')
  ORDER BY o.tracking_number;
END;
$$;

-- تنفيذ التصحيح
SELECT * FROM fix_partial_delivery_amounts();

-- حذف الدالة المؤقتة
DROP FUNCTION IF EXISTS fix_partial_delivery_amounts();