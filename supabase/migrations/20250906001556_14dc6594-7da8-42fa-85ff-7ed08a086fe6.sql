-- دالة لمزامنة طلبات موظف محدد
CREATE OR REPLACE FUNCTION public.sync_employee_orders(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_updated_orders integer := 0;
  v_error_message text := '';
  v_success boolean := true;
  v_log_id uuid;
BEGIN
  -- التحقق من صلاحية المستخدم
  IF NOT is_admin_or_deputy() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح لك بهذا الإجراء'
    );
  END IF;

  -- تسجيل بداية العملية
  INSERT INTO public.auto_sync_log (
    sync_type, triggered_by, started_at, success
  ) VALUES (
    'employee_manual', auth.uid()::text, now(), false
  ) RETURNING id INTO v_log_id;

  -- محاولة تحديث حالات الطلبات (محاكاة - في التطبيق الحقيقي ستستدعي API)
  UPDATE public.orders 
  SET updated_at = now()
  WHERE created_by = p_employee_id
    AND status IN ('pending', 'shipped', 'delivery')
    AND created_at >= now() - interval '30 days';
  
  GET DIAGNOSTICS v_updated_orders = ROW_COUNT;

  -- تحديث سجل المزامنة
  UPDATE public.auto_sync_log 
  SET 
    completed_at = now(),
    success = v_success,
    orders_updated = v_updated_orders,
    employees_processed = 1
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'success', v_success,
    'updated_orders', v_updated_orders,
    'message', 'تم تحديث ' || v_updated_orders || ' طلب للموظف'
  );
EXCEPTION
  WHEN OTHERS THEN
    v_error_message := SQLERRM;
    v_success := false;
    
    -- تحديث سجل المزامنة بالخطأ
    UPDATE public.auto_sync_log 
    SET 
      completed_at = now(),
      success = false,
      error_message = v_error_message
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
END;
$function$;