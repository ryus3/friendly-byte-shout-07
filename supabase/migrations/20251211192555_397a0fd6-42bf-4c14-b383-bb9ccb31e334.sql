-- إصلاح شامل لدالة fix_inventory_discrepancies
-- المشكلة: الدالة تحاول معالجة TABLE output كـ jsonb
-- الحل: استخدام FOR...IN SELECT مباشرة

DROP FUNCTION IF EXISTS fix_inventory_discrepancies();

CREATE OR REPLACE FUNCTION fix_inventory_discrepancies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_fixed_count integer := 0;
  v_fixed_items jsonb := '[]'::jsonb;
  v_old_reserved integer;
  v_old_sold integer;
BEGIN
  -- استخدام FOR...IN SELECT للتكرار على نتائج الفحص مباشرة
  FOR v_record IN SELECT * FROM audit_inventory_accuracy() LOOP
    -- حفظ القيم القديمة
    SELECT reserved_quantity, sold_quantity 
    INTO v_old_reserved, v_old_sold
    FROM inventory 
    WHERE variant_id = v_record.variant_id;
    
    -- تحديث المخزون بالقيم الصحيحة
    UPDATE inventory SET 
      reserved_quantity = v_record.calculated_reserved,
      sold_quantity = v_record.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = v_record.variant_id;
    
    -- تسجيل العملية في سجل العمليات
    INSERT INTO inventory_operations_log (
      variant_id,
      operation_type,
      quantity_before,
      quantity_after,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      source_type,
      source_id,
      notes,
      performed_by
    ) VALUES (
      v_record.variant_id,
      'audit_fix',
      v_record.current_quantity,
      v_record.current_quantity,
      v_old_reserved,
      v_record.calculated_reserved,
      v_old_sold,
      v_record.calculated_sold,
      'system',
      'audit_fix_' || NOW()::text,
      format('إصلاح تلقائي: محجوز %s→%s، مباع %s→%s', 
        v_old_reserved, v_record.calculated_reserved,
        v_old_sold, v_record.calculated_sold),
      NULL
    );
    
    -- إضافة للقائمة
    v_fixed_items := v_fixed_items || jsonb_build_object(
      'variant_id', v_record.variant_id,
      'product_name', v_record.product_name,
      'old_reserved', v_old_reserved,
      'new_reserved', v_record.calculated_reserved,
      'old_sold', v_old_sold,
      'new_sold', v_record.calculated_sold
    );
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'fixed_count', v_fixed_count,
    'fixed_items', v_fixed_items,
    'fixed_at', NOW()
  );
END;
$$;

-- إنشاء الترغر المفقود لتحديث sold_quantity عند التسليم
-- هذا الترغر يجعل النظام يحدث sold_quantity تلقائياً عند delivery_status='4'

DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;

CREATE TRIGGER trg_handle_order_status_change
  BEFORE UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_change();

-- تصحيح الفروقات الحالية مباشرة (7 منتجات)
-- 5 منتجات sold_quantity +1، 2 منتجات reserved_quantity +1

-- إصلاح sold_quantity للمنتجات الخمسة
UPDATE inventory i
SET sold_quantity = sold_quantity + 1
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE (p.name ILIKE '%فنتازيا%' AND pv.color_id IN (
    SELECT c.id FROM colors c WHERE c.name IN ('بيج', 'اسود')
  ))
  OR (p.name ILIKE '%كلاسيك%' AND pv.color_id IN (
    SELECT c.id FROM colors c WHERE c.name IN ('زيتي', 'كحلي')
  ))
  OR (p.name ILIKE '%رياضي%' AND pv.color_id IN (
    SELECT c.id FROM colors c WHERE c.name = 'رصاصي'
  ))
);

-- إصلاح reserved_quantity للمنتجين
UPDATE inventory i
SET reserved_quantity = reserved_quantity + 1
WHERE variant_id IN (
  SELECT pv.id FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE (p.name ILIKE '%فنتازيا%' AND pv.color_id IN (
    SELECT c.id FROM colors c WHERE c.name = 'كاكي'
  ))
  OR (p.name ILIKE '%كلاسيك%' AND pv.color_id IN (
    SELECT c.id FROM colors c WHERE c.name = 'بني'
  ))
);