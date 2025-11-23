-- =============================================
-- الخطة الشاملة: إصلاح نظام التسليم الجزئي جذرياً
-- =============================================

-- ============================================
-- 1. تعديل recalculate_order_totals() لفهم التسليم الجزئي
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  items_total numeric := 0;
  items_total_with_delivery numeric;
  order_delivery_fee numeric := 0;
  order_discount numeric := 0;
  correct_final numeric := 0;
  current_order_type text;
  v_delivery_fee numeric;
BEGIN
  -- جلب نوع الطلب
  SELECT order_type INTO current_order_type
  FROM orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  -- ✅ معالجة خاصة للتسليم الجزئي: استخدام partial_delivery_history
  IF current_order_type = 'partial_delivery' THEN
    SELECT delivered_revenue, delivery_fee_allocated
    INTO items_total_with_delivery, v_delivery_fee
    FROM partial_delivery_history
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ORDER BY created_at DESC
    LIMIT 1;

    IF items_total_with_delivery IS NOT NULL THEN
      -- total_amount = سعر المنتجات المسلَّمة فقط (بدون التوصيل)
      items_total := GREATEST(0, items_total_with_delivery - COALESCE(v_delivery_fee, 0));
      order_delivery_fee := COALESCE(v_delivery_fee, 0);
      order_discount := 0; -- التسليم الجزئي ليس خصماً
      correct_final := items_total + order_delivery_fee - order_discount;

      UPDATE orders
      SET
        total_amount = items_total,
        final_amount = correct_final,
        delivery_fee = order_delivery_fee,
        discount = order_discount,
        updated_at = now()
      WHERE id = COALESCE(NEW.order_id, OLD.order_id);

      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- المنطق العادي للطلبات الأخرى
  SELECT 
    COALESCE(SUM(oi.quantity * oi.unit_price), 0),
    o.delivery_fee,
    o.discount
  INTO items_total, order_delivery_fee, order_discount
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id)
  GROUP BY o.delivery_fee, o.discount;

  order_delivery_fee := COALESCE(order_delivery_fee, 0);
  order_discount := COALESCE(order_discount, 0);
  correct_final := GREATEST(0, items_total - order_discount + order_delivery_fee);

  UPDATE orders
  SET 
    total_amount = items_total,
    final_amount = correct_final,
    updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. تعديل validate_order_calculations() لفهم التسليم الجزئي
-- ============================================
CREATE OR REPLACE FUNCTION validate_order_calculations()
RETURNS TRIGGER AS $$
DECLARE
  items_total numeric;
  v_delivered_revenue numeric;
  v_delivery_fee numeric;
BEGIN
  -- ✅ معالجة خاصة للتسليم الجزئي
  IF NEW.order_type = 'partial_delivery' THEN
    SELECT delivered_revenue, delivery_fee_allocated
    INTO v_delivered_revenue, v_delivery_fee
    FROM partial_delivery_history
    WHERE order_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_delivered_revenue IS NOT NULL THEN
      NEW.total_amount := GREATEST(0, v_delivered_revenue - COALESCE(v_delivery_fee, 0));
      NEW.delivery_fee := COALESCE(v_delivery_fee, NEW.delivery_fee, 0);
      NEW.discount := 0;
      NEW.final_amount := NEW.total_amount + NEW.delivery_fee - NEW.discount;
      RETURN NEW;
    END IF;
  END IF;

  -- المنطق العادي
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
  INTO items_total
  FROM order_items oi
  WHERE oi.order_id = NEW.id;

  NEW.total_amount := COALESCE(NEW.total_amount, items_total);
  NEW.delivery_fee := COALESCE(NEW.delivery_fee, 0);
  NEW.discount := COALESCE(NEW.discount, 0);
  NEW.sales_amount := GREATEST(0, NEW.total_amount - NEW.discount);
  NEW.final_amount := GREATEST(0, NEW.sales_amount + NEW.delivery_fee);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. تعديل normalize_order_amounts() لفهم التسليم الجزئي
-- ============================================
CREATE OR REPLACE FUNCTION normalize_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ التسليم الجزئي: الأرقام تأتي من partial_delivery_history
  IF NEW.order_type = 'partial_delivery' THEN
    NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount, 0));
    NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.discount, 0) + COALESCE(NEW.delivery_fee, 0));
    RETURN NEW;
  END IF;

  -- المنطق العادي
  NEW.total_amount := COALESCE(NEW.total_amount, 0);
  NEW.delivery_fee := COALESCE(NEW.delivery_fee, 0);
  NEW.discount := COALESCE(NEW.discount, 0);
  NEW.sales_amount := GREATEST(0, NEW.total_amount - NEW.discount);
  NEW.final_amount := GREATEST(0, NEW.sales_amount + NEW.delivery_fee);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. تعديل update_inventory_reserved_quantity() لاستثناء العائد للمخزون
-- ============================================
CREATE OR REPLACE FUNCTION update_inventory_reserved_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_variant_id uuid;
  v_reserved_qty integer;
BEGIN
  v_variant_id := COALESCE(NEW.variant_id, OLD.variant_id);

  -- ✅ حساب المحجوز الفعلي: استثناء delivered و returned_in_stock و returned
  SELECT COALESCE(SUM(oi.quantity), 0)::integer
  INTO v_reserved_qty
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.variant_id = v_variant_id
    AND o.status IN ('pending', 'shipped', 'in_delivery', 'returned')
    AND o.order_type != 'return'
    AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
    AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned'));

  UPDATE inventory
  SET 
    reserved_quantity = v_reserved_qty,
    updated_at = now()
  WHERE variant_id = v_variant_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. تصحيح جميع طلبات التسليم الجزئي الموجودة
-- ============================================
CREATE OR REPLACE FUNCTION fix_all_partial_delivery_orders()
RETURNS TABLE(
  order_tracking text,
  old_final numeric,
  new_final numeric,
  old_total numeric,
  new_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_items_total numeric;
  v_fee numeric;
  v_old_final numeric;
  v_old_total numeric;
BEGIN
  FOR r IN
    SELECT o.id, o.tracking_number, o.final_amount, o.total_amount,
           h.delivered_revenue, h.delivery_fee_allocated
    FROM orders o
    JOIN partial_delivery_history h ON h.order_id = o.id
    WHERE o.order_type = 'partial_delivery'
      AND h.created_at = (
        SELECT MAX(created_at) FROM partial_delivery_history h2 WHERE h2.order_id = o.id
      )
  LOOP
    v_old_final := r.final_amount;
    v_old_total := r.total_amount;
    
    v_fee := COALESCE(r.delivery_fee_allocated, 0);
    v_items_total := GREATEST(0, r.delivered_revenue - v_fee);

    UPDATE orders
    SET
      total_amount = v_items_total,
      final_amount = r.delivered_revenue,
      delivery_fee = v_fee,
      discount = 0,
      updated_at = now()
    WHERE id = r.id;

    order_tracking := r.tracking_number;
    old_final := v_old_final;
    new_final := r.delivered_revenue;
    old_total := v_old_total;
    new_total := v_items_total;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- تنفيذ التصحيح
SELECT * FROM fix_all_partial_delivery_orders();

-- ============================================
-- 6. إعادة حساب reserved_quantity لجميع المنتجات
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_all_reserved_quantities()
RETURNS TABLE(variant_id uuid, old_reserved integer, new_reserved integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_reserved_qty integer;
  v_old_reserved integer;
BEGIN
  FOR r IN SELECT DISTINCT i.variant_id, i.reserved_quantity FROM inventory i
  LOOP
    v_old_reserved := r.reserved_quantity;
    
    SELECT COALESCE(SUM(oi.quantity), 0)::integer
    INTO v_reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.variant_id = r.variant_id
      AND o.status IN ('pending', 'shipped', 'in_delivery', 'returned')
      AND o.order_type != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
      AND (oi.item_status IS NULL OR oi.item_status NOT IN ('delivered', 'returned_in_stock', 'returned'));

    UPDATE inventory
    SET reserved_quantity = v_reserved_qty, updated_at = now()
    WHERE inventory.variant_id = r.variant_id;

    variant_id := r.variant_id;
    old_reserved := v_old_reserved;
    new_reserved := v_reserved_qty;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- تنفيذ إعادة الحساب
SELECT * FROM recalculate_all_reserved_quantities();

-- ============================================
-- 7. تنظيف الدوال المؤقتة
-- ============================================
DROP FUNCTION IF EXISTS fix_all_partial_delivery_orders();
DROP FUNCTION IF EXISTS recalculate_all_reserved_quantities();