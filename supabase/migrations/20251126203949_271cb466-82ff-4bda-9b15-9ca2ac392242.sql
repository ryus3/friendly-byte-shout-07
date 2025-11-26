-- إصلاح شامل: منع الخصم المزدوج في triggers + تصحيح الطلب 112762972

-- ============================================
-- 1. إصلاح دالة recalculate_order_totals
-- ============================================
-- القاعدة: discount للعرض فقط - لا يُخصم من final_amount

DROP FUNCTION IF EXISTS recalculate_order_totals() CASCADE;

CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  items_total DECIMAL(10,2);
  order_discount DECIMAL(10,2);
  order_delivery_fee DECIMAL(10,2);
  correct_final DECIMAL(10,2);
BEGIN
  -- حساب مجموع المنتجات
  SELECT COALESCE(SUM(total_price), 0)
  INTO items_total
  FROM order_items
  WHERE order_id = NEW.order_id;

  -- جلب الخصم ورسوم التوصيل من جدول الطلبات
  SELECT COALESCE(discount, 0), COALESCE(delivery_fee, 0)
  INTO order_discount, order_delivery_fee
  FROM orders
  WHERE id = NEW.order_id;

  -- ✅ الحساب الصحيح: discount لا يُخصم من final_amount
  -- discount للعرض فقط (يظهر للعميل كم وفّر)
  correct_final := items_total + order_delivery_fee;

  -- تحديث جدول الطلبات
  UPDATE orders
  SET 
    total_amount = items_total,
    final_amount = correct_final,
    sales_amount = items_total  -- ✅ بدون خصم discount
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء trigger
DROP TRIGGER IF EXISTS recalculate_totals_on_item_change ON order_items;
CREATE TRIGGER recalculate_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_totals();

COMMENT ON FUNCTION recalculate_order_totals() IS 'CRITICAL: discount للعرض فقط - لا يُخصم من final_amount أو sales_amount. المنطق الصحيح: final_amount = items_total + delivery_fee';

-- ============================================
-- 2. إصلاح دالة normalize_order_amounts
-- ============================================
-- التأكد من عدم خصم discount مرتين

DROP FUNCTION IF EXISTS normalize_order_amounts() CASCADE;

CREATE OR REPLACE FUNCTION normalize_order_amounts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- ✅ القاعدة الصحيحة: discount للعرض فقط
  -- total_amount = السعر الفعلي للمنتجات (بعد أي خصم من شركة التوصيل)
  -- sales_amount = total_amount (بدون خصم discount مرة أخرى)
  -- final_amount = total_amount + delivery_fee (بدون خصم discount)
  
  NEW.sales_amount := COALESCE(NEW.total_amount, 0);
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء trigger
DROP TRIGGER IF EXISTS normalize_amounts_before_update ON orders;
CREATE TRIGGER normalize_amounts_before_update
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION normalize_order_amounts();

COMMENT ON FUNCTION normalize_order_amounts() IS 'CRITICAL: discount للعرض فقط. المنطق: sales_amount = total_amount, final_amount = total_amount + delivery_fee (بدون خصم discount)';

-- ============================================
-- 3. تصحيح الطلب 112762972
-- ============================================
-- السعر الأصلي: 28,000 منتجات + 5,000 توصيل = 33,000
-- شركة التوصيل أعطت خصم 2,000 → أصبح 31,000
-- discount = 2,000 للعرض فقط

-- تعطيل triggers مؤقتاً للتصحيح اليدوي
SET session_replication_role = 'replica';

UPDATE orders 
SET 
  total_amount = 26000,      -- سعر المنتجات من الشركة (31,000 - 5,000)
  discount = 2000,           -- الخصم للعرض فقط (28,000 - 26,000)
  price_increase = 0,
  price_change_type = 'discount',
  delivery_fee = 5000,
  sales_amount = 26000,      -- ✅ total_amount بدون خصم discount
  final_amount = 31000       -- ✅ 26,000 + 5,000 = 31,000
WHERE tracking_number = '112762972';

-- إعادة تفعيل triggers
SET session_replication_role = 'origin';

-- ============================================
-- تحقق نهائي
-- ============================================
DO $$
DECLARE
  order_check RECORD;
BEGIN
  SELECT 
    tracking_number,
    total_amount,
    discount,
    sales_amount,
    delivery_fee,
    final_amount
  INTO order_check
  FROM orders
  WHERE tracking_number = '112762972';
  
  RAISE NOTICE 'تم تصحيح الطلب 112762972:';
  RAISE NOTICE 'total_amount: %', order_check.total_amount;
  RAISE NOTICE 'discount: % (للعرض فقط)', order_check.discount;
  RAISE NOTICE 'sales_amount: %', order_check.sales_amount;
  RAISE NOTICE 'delivery_fee: %', order_check.delivery_fee;
  RAISE NOTICE 'final_amount: % ✅', order_check.final_amount;
  
  IF order_check.final_amount != 31000 THEN
    RAISE EXCEPTION 'خطأ: final_amount يجب أن يكون 31,000';
  END IF;
  
  IF order_check.sales_amount != 26000 THEN
    RAISE EXCEPTION 'خطأ: sales_amount يجب أن يكون 26,000';
  END IF;
END $$;