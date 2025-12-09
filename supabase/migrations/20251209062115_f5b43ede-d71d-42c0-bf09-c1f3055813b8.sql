-- =====================================================
-- الخطة الشاملة: إصلاح Triggers المتضاربة + تصحيح البيانات
-- =====================================================

-- 1. حذف Trigger المكرر على الحذف (AFTER DELETE)
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete ON orders;

-- 2. حذف Trigger المكرر على البيع
DROP TRIGGER IF EXISTS trg_update_sold_on_delivery ON orders;

-- 3. تحديث constraint لدعم المزيد من الأنواع
ALTER TABLE inventory_operations_log 
DROP CONSTRAINT IF EXISTS inventory_operations_log_operation_type_check;

ALTER TABLE inventory_operations_log 
ADD CONSTRAINT inventory_operations_log_operation_type_check 
CHECK (operation_type = ANY (ARRAY[
  'stock_added', 'stock_reduced', 'reserved', 'released', 
  'sold', 'returned', 'audit_correction', 'manual_edit',
  'reserved_released', 'returned_to_stock'
]));

-- 4. إصلاح دالة release_stock_item - تُحرر المحجوز فقط
CREATE OR REPLACE FUNCTION public.release_stock_item(
  p_variant_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'تحرير محجوز'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_reserved INTEGER;
  v_current_quantity INTEGER;
  v_current_sold INTEGER;
  v_release_amount INTEGER;
  v_product_id UUID;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
BEGIN
  -- الحصول على البيانات الحالية
  SELECT i.reserved_quantity, i.quantity, i.sold_quantity, i.product_id,
         p.name, c.name, s.name
  INTO v_current_reserved, v_current_quantity, v_current_sold, v_product_id,
       v_product_name, v_color_name, v_size_name
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  WHERE i.variant_id = p_variant_id
  FOR UPDATE OF i;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;
  
  -- حساب الكمية للتحرير
  v_release_amount := LEAST(p_quantity, COALESCE(v_current_reserved, 0));
  
  IF v_release_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No reserved stock to release', 'released', 0);
  END IF;
  
  -- تحرير المحجوز فقط - لا نمس quantity أو sold_quantity
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_release_amount),
    updated_at = NOW()
  WHERE variant_id = p_variant_id;
  
  -- تسجيل العملية
  INSERT INTO inventory_operations_log (
    variant_id, product_id, product_name, color_name, size_value,
    operation_type, quantity_change,
    quantity_before, quantity_after,
    reserved_before, reserved_after,
    sold_before, sold_after,
    order_id, source_type, notes, created_at
  ) VALUES (
    p_variant_id, v_product_id, v_product_name, v_color_name, v_size_name,
    'released', -v_release_amount,
    v_current_quantity, v_current_quantity,
    v_current_reserved, GREATEST(0, v_current_reserved - v_release_amount),
    v_current_sold, v_current_sold,
    p_order_id, 'system', p_reason, NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'released', v_release_amount,
    'new_reserved', GREATEST(0, v_current_reserved - v_release_amount),
    'quantity_unchanged', v_current_quantity
  );
END;
$$;

-- 5. إصلاح دالة return_stock_item (عند الإرجاع حالة 17)
CREATE OR REPLACE FUNCTION public.return_stock_item(
  p_variant_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'إرجاع للمخزون'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_reserved INTEGER;
  v_current_quantity INTEGER;
  v_current_sold INTEGER;
  v_release_amount INTEGER;
  v_product_id UUID;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
BEGIN
  -- الحصول على البيانات الحالية
  SELECT i.reserved_quantity, i.quantity, i.sold_quantity, i.product_id,
         p.name, c.name, s.name
  INTO v_current_reserved, v_current_quantity, v_current_sold, v_product_id,
       v_product_name, v_color_name, v_size_name
  FROM inventory i
  JOIN product_variants pv ON pv.id = i.variant_id
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN colors c ON c.id = pv.color_id
  LEFT JOIN sizes s ON s.id = pv.size_id
  WHERE i.variant_id = p_variant_id
  FOR UPDATE OF i;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;
  
  v_release_amount := LEAST(p_quantity, COALESCE(v_current_reserved, 0));
  
  IF v_release_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No reserved stock to return', 'returned', 0);
  END IF;
  
  -- تحرير المحجوز فقط
  UPDATE inventory
  SET 
    reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - v_release_amount),
    updated_at = NOW()
  WHERE variant_id = p_variant_id;
  
  -- تسجيل العملية
  INSERT INTO inventory_operations_log (
    variant_id, product_id, product_name, color_name, size_value,
    operation_type, quantity_change,
    quantity_before, quantity_after,
    reserved_before, reserved_after,
    sold_before, sold_after,
    order_id, source_type, notes, created_at
  ) VALUES (
    p_variant_id, v_product_id, v_product_name, v_color_name, v_size_name,
    'returned', -v_release_amount,
    v_current_quantity, v_current_quantity,
    v_current_reserved, GREATEST(0, v_current_reserved - v_release_amount),
    v_current_sold, v_current_sold,
    p_order_id, 'system', p_reason, NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'returned', v_release_amount,
    'new_reserved', GREATEST(0, v_current_reserved - v_release_amount)
  );
END;
$$;

-- 6. تصحيح بيانات ترانش أسود
UPDATE inventory
SET 
  quantity = 50,
  sold_quantity = 0,
  reserved_quantity = 8,
  updated_at = NOW()
WHERE variant_id = '0ddc583b-3fa8-41ba-a65c-c0636cec5987';

-- 7. تسجيل عملية التصحيح
INSERT INTO inventory_operations_log (
  variant_id, product_id, product_name, color_name, size_value,
  operation_type, quantity_change,
  quantity_before, quantity_after,
  reserved_before, reserved_after,
  sold_before, sold_after,
  source_type, notes, created_at
) 
SELECT 
  '0ddc583b-3fa8-41ba-a65c-c0636cec5987',
  pv.product_id,
  p.name,
  c.name,
  s.name,
  'audit_correction', 6,
  44, 50,
  8, 8,
  6, 0,
  'audit',
  'تصحيح شامل: إصلاح المخزون بعد اكتشاف خطأ في triggers - لا يوجد طلبات delivered',
  NOW()
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN colors c ON c.id = pv.color_id
LEFT JOIN sizes s ON s.id = pv.size_id
WHERE pv.id = '0ddc583b-3fa8-41ba-a65c-c0636cec5987';