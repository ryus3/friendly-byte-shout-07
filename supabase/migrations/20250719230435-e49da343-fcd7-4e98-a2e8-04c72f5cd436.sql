-- إضافة عمود تكاليف التحويل لجدول purchases
ALTER TABLE purchases ADD COLUMN transfer_cost NUMERIC DEFAULT 0;

-- تحديث trigger لحساب الإجمالي مع تكاليف التحويل
CREATE OR REPLACE FUNCTION calculate_purchase_total()
RETURNS TRIGGER AS $$
BEGIN
  -- حساب إجمالي الفاتورة = إجمالي المنتجات + تكلفة الشحن + تكاليف التحويل
  NEW.total_amount = COALESCE(NEW.total_amount, 0) + COALESCE(NEW.shipping_cost, 0) + COALESCE(NEW.transfer_cost, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;