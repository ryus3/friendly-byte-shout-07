-- إصلاح دالة fix_inventory_discrepancies لاستخدام الأعمدة الصحيحة
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies() CASCADE;

CREATE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE(
  fixed_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
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
  FOR r IN 
    SELECT * FROM audit_inventory_accuracy() WHERE issue_type != 'ok'
  LOOP
    SELECT reserved_quantity, sold_quantity 
    INTO v_old_reserved, v_old_sold
    FROM inventory WHERE variant_id = r.variant_id;
    
    UPDATE inventory
    SET 
      reserved_quantity = r.calculated_reserved,
      sold_quantity = r.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = r.variant_id;
    
    INSERT INTO inventory_operations_log (
      product_id, variant_id, product_name, color_name, size_value,
      operation_type, quantity_change,
      quantity_before, quantity_after, 
      reserved_before, reserved_after,
      sold_before, sold_after,
      notes, source_type, performed_by, performed_at
    ) VALUES (
      r.product_id, r.variant_id, r.product_name, r.color_name, r.size_value,
      'audit_correction', 0,
      r.current_quantity, r.current_quantity,
      v_old_reserved, r.calculated_reserved,
      v_old_sold, r.calculated_sold,
      format('تصحيح تلقائي: محجوز %s→%s، مباع %s→%s', v_old_reserved, r.calculated_reserved, v_old_sold, r.calculated_sold),
      'audit', 'system', NOW()
    );
    
    fixed_variant_id := r.variant_id;
    product_name := r.product_name;
    color_name := r.color_name;
    size_value := r.size_value;
    old_reserved := v_old_reserved;
    new_reserved := r.calculated_reserved;
    old_sold := v_old_sold;
    new_sold := r.calculated_sold;
    fix_type := r.issue_type;
    RETURN NEXT;
  END LOOP;
END;
$$;