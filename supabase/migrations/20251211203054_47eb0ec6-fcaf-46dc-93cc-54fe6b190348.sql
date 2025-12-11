-- إصلاح دالة fix_inventory_discrepancies بإضافة عمود quantity_change المطلوب

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
  -- جلب الفروقات من دالة التدقيق
  FOR v_record IN SELECT * FROM audit_inventory_accuracy() LOOP
    -- جلب القيم الحالية
    SELECT reserved_quantity, sold_quantity 
    INTO v_old_reserved, v_old_sold
    FROM inventory WHERE variant_id = v_record.variant_id;
    
    -- تحديث المخزون بالقيم المحسوبة الصحيحة
    UPDATE inventory SET 
      reserved_quantity = v_record.calculated_reserved,
      sold_quantity = v_record.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = v_record.variant_id;
    
    -- تسجيل العملية في سجل العمليات مع quantity_change = 0
    INSERT INTO inventory_operations_log (
      variant_id,
      operation_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      source_type,
      notes,
      performed_by
    ) VALUES (
      v_record.variant_id,
      'audit_fix',
      0,
      v_record.current_quantity,
      v_record.current_quantity,
      v_old_reserved,
      v_record.calculated_reserved,
      v_old_sold,
      v_record.calculated_sold,
      'system',
      format('إصلاح تلقائي: محجوز %s→%s، مباع %s→%s', 
        v_old_reserved, v_record.calculated_reserved,
        v_old_sold, v_record.calculated_sold),
      NULL
    );
    
    -- إضافة للنتائج
    v_fixed_items := v_fixed_items || jsonb_build_object(
      'variant_id', v_record.variant_id,
      'product_name', v_record.product_name,
      'color_name', v_record.color_name,
      'size_name', v_record.size_name,
      'old_reserved', v_old_reserved,
      'new_reserved', v_record.calculated_reserved,
      'old_sold', v_old_sold,
      'new_sold', v_record.calculated_sold
    );
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', v_fixed_count,
    'fixed_items', v_fixed_items
  );
END;
$$;