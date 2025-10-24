-- ✅ حل جذري: تعديل trigger حساب المبلغ الإجمالي ليدعم نظام الاستبدال المنعزل
-- ⚠️ لا يؤثر على الطلبات العادية أو طلبات الإرجاع

-- تعديل دالة recalculate_order_totals لدعم الاستبدال
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  order_id_to_update UUID;
  items_total NUMERIC := 0;
  order_delivery_fee NUMERIC := 0;
  order_discount NUMERIC := 0;
  correct_final NUMERIC := 0;
  current_order_type TEXT;
BEGIN
  -- تحديد معرف الطلب
  IF TG_OP = 'DELETE' THEN
    order_id_to_update := OLD.order_id;
  ELSE
    order_id_to_update := NEW.order_id;
  END IF;
  
  -- الحصول على نوع الطلب
  SELECT order_type INTO current_order_type
  FROM orders 
  WHERE id = order_id_to_update;
  
  -- ✅ حساب مجموع أسعار العناصر حسب نوع الطلب
  IF current_order_type IN ('replacement', 'exchange') THEN
    -- 🔄 للاستبدال: (الصادر - الوارد) = فرق السعر فقط
    SELECT COALESCE(SUM(
      CASE 
        WHEN item_direction = 'outgoing' THEN total_price
        WHEN item_direction = 'incoming' THEN -total_price
        ELSE 0  -- ✅ تجاهل أي منتجات بدون اتجاه محدد
      END
    ), 0) INTO items_total
    FROM order_items 
    WHERE order_id = order_id_to_update;
    
    -- ✅ التأكد من أن الفرق موجب أو صفر
    items_total := GREATEST(items_total, 0);
    
  ELSE
    -- ✅ للطلبات العادية والإرجاع: مجموع جميع المنتجات
    SELECT COALESCE(SUM(total_price), 0) INTO items_total
    FROM order_items 
    WHERE order_id = order_id_to_update;
  END IF;
  
  -- الحصول على رسوم التوصيل والخصم
  SELECT COALESCE(delivery_fee, 0), COALESCE(discount, 0)
  INTO order_delivery_fee, order_discount
  FROM orders 
  WHERE id = order_id_to_update;
  
  -- حساب المجموع النهائي
  correct_final := items_total + order_delivery_fee - order_discount;
  
  -- تحديث الطلب
  UPDATE orders 
  SET 
    total_amount = items_total,
    final_amount = correct_final,
    updated_at = now()
  WHERE id = order_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ✅ تعديل دالة validate_order_calculations لدعم الاستبدال أيضاً
CREATE OR REPLACE FUNCTION validate_order_calculations()
RETURNS TRIGGER AS $$
DECLARE
  items_total NUMERIC := 0;
  correct_final NUMERIC := 0;
BEGIN
  -- ✅ حساب مجموع أسعار العناصر حسب نوع الطلب
  IF NEW.order_type IN ('replacement', 'exchange') THEN
    -- 🔄 للاستبدال: (الصادر - الوارد) = فرق السعر فقط
    SELECT COALESCE(SUM(
      CASE 
        WHEN item_direction = 'outgoing' THEN total_price
        WHEN item_direction = 'incoming' THEN -total_price
        ELSE 0
      END
    ), 0) INTO items_total
    FROM order_items 
    WHERE order_id = NEW.id;
    
    -- ✅ التأكد من أن الفرق موجب أو صفر
    items_total := GREATEST(items_total, 0);
    
  ELSE
    -- ✅ للطلبات العادية والإرجاع: مجموع جميع المنتجات
    SELECT COALESCE(SUM(total_price), 0) INTO items_total
    FROM order_items 
    WHERE order_id = NEW.id;
  END IF;
  
  -- حساب المجموع النهائي الصحيح
  correct_final := items_total + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount, 0);
  
  -- تصحيح القيم إذا كانت خاطئة
  IF items_total > 0 OR NEW.order_type IN ('replacement', 'exchange') THEN
    NEW.total_amount := items_total;
    NEW.final_amount := correct_final;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ إعادة إنشاء الـ triggers (للتأكد من استخدام الدوال المحدثة)
DROP TRIGGER IF EXISTS validate_order_calculations_trigger ON orders;
CREATE TRIGGER validate_order_calculations_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_calculations();

DROP TRIGGER IF EXISTS recalculate_order_totals_trigger ON order_items;
CREATE TRIGGER recalculate_order_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_totals();