-- إصلاح أمني: إضافة SET search_path للدالة calculate_order_amounts
-- يمنع هجمات search_path poisoning

CREATE OR REPLACE FUNCTION calculate_order_amounts()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- ✅ الصيغة الصحيحة: total_amount يحتوي على السعر بعد الخصم بالفعل
  -- discount حقل للعرض فقط - لا يُخصم مرة أخرى من final_amount
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_order_amounts() IS 'إصلاح جذري 2025-11-26: إزالة الخصم المزدوج - total_amount يحتوي على السعر بعد الخصم، discount للعرض فقط. محمي بـ search_path.';