
-- حذف الدالة القديمة وإعادة إنشائها
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies();

-- إعادة إنشاء دالة fix_inventory_discrepancies بالمنطق المُصحح
CREATE OR REPLACE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_variant_id uuid,
  product_name text,
  old_reserved integer,
  new_reserved integer,
  old_sold integer,
  new_sold integer,
  fix_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_old_reserved integer;
  v_old_sold integer;
BEGIN
  -- جلب جميع الفروقات من دالة التدقيق
  FOR r IN SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  LOOP
    -- حفظ القيم القديمة
    SELECT reserved_quantity, COALESCE(sold_quantity, 0) 
    INTO v_old_reserved, v_old_sold
    FROM inventory WHERE variant_id = r.variant_id;
    
    -- تحديث المخزون بالقيم الصحيحة
    UPDATE inventory 
    SET 
      reserved_quantity = r.calculated_reserved,
      sold_quantity = r.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = r.variant_id;
    
    -- تسجيل العملية في سجل العمليات
    INSERT INTO inventory_operations_log (
      variant_id,
      operation_type,
      source_type,
      quantity_change,
      stock_before,
      stock_after,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      available_before,
      available_after,
      notes,
      created_at
    ) VALUES (
      r.variant_id,
      'audit_correction',
      'audit',
      0,
      r.current_quantity,
      r.current_quantity,
      v_old_reserved,
      r.calculated_reserved,
      v_old_sold,
      r.calculated_sold,
      r.current_quantity - v_old_reserved,
      r.calculated_available,
      'تصحيح تلقائي: محجوز ' || v_old_reserved || '→' || r.calculated_reserved || 
      '، مباع ' || v_old_sold || '→' || r.calculated_sold,
      NOW()
    );
    
    -- إرجاع النتيجة
    fixed_variant_id := r.variant_id;
    product_name := r.product_name;
    old_reserved := v_old_reserved;
    new_reserved := r.calculated_reserved;
    old_sold := v_old_sold;
    new_sold := r.calculated_sold;
    fix_type := r.issue_type;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;
