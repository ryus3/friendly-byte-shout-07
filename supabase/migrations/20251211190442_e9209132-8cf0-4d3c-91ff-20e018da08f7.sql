
-- حذف الدالة القديمة أولاً ثم إعادة إنشائها
DROP FUNCTION IF EXISTS fix_inventory_discrepancies();

CREATE FUNCTION public.fix_inventory_discrepancies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_results jsonb;
  v_fixed_count integer := 0;
  v_record record;
  v_log_entry jsonb;
  v_logs jsonb := '[]'::jsonb;
BEGIN
  v_audit_results := audit_inventory_accuracy();
  
  FOR v_record IN 
    SELECT * FROM jsonb_to_recordset(v_audit_results->'results') AS x(
      variant_id uuid,
      product_name text,
      color_name text,
      size_value text,
      current_quantity integer,
      current_reserved integer,
      current_sold integer,
      calculated_reserved integer,
      calculated_sold integer,
      issue_type text
    )
    WHERE x.issue_type != 'ok'
  LOOP
    INSERT INTO product_tracking_log (
      variant_id, operation_type, quantity_before, quantity_after,
      reserved_before, reserved_after, sold_before, sold_after,
      source_type, notes, performed_by
    ) VALUES (
      v_record.variant_id, 'system_fix', v_record.current_quantity, v_record.current_quantity,
      v_record.current_reserved, v_record.calculated_reserved,
      v_record.current_sold, v_record.calculated_sold,
      'audit_fix', format('إصلاح: %s', v_record.issue_type), auth.uid()
    );
    
    UPDATE inventory SET 
      reserved_quantity = v_record.calculated_reserved,
      sold_quantity = v_record.calculated_sold,
      updated_at = NOW()
    WHERE variant_id = v_record.variant_id;
    
    v_fixed_count := v_fixed_count + 1;
    v_logs := v_logs || jsonb_build_object(
      'variant_id', v_record.variant_id,
      'product_name', v_record.product_name,
      'issue_type', v_record.issue_type
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', v_fixed_count,
    'fixes', v_logs,
    'message', format('تم إصلاح %s منتج', v_fixed_count)
  );
END;
$$;
