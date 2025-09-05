-- دالة محسنة لتنظيف فواتير التوصيل مع الحفاظ على الفواتير الحديثة
CREATE OR REPLACE FUNCTION public.cleanup_delivery_invoices_keep_recent_and_latest(
  p_keep_count integer DEFAULT 15,
  p_keep_recent_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_deleted integer := 0;
  v_employee_record record;
  v_recent_cutoff timestamp with time zone;
BEGIN
  -- حساب تاريخ القطع للفواتير الحديثة
  v_recent_cutoff := now() - (p_keep_recent_days || ' days')::interval;
  
  -- تنظيف الفواتير لكل موظف على حدة
  FOR v_employee_record IN 
    SELECT DISTINCT owner_user_id 
    FROM public.delivery_invoices 
    WHERE owner_user_id IS NOT NULL
      AND partner = 'alwaseet'
  LOOP
    -- حذف الفواتير القديمة للموظف مع الاحتفاظ بآخر N فاتورة والفواتير الحديثة
    WITH ranked_invoices AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY owner_user_id 
               ORDER BY COALESCE(issued_at, created_at) DESC, created_at DESC
             ) as rn,
             COALESCE(issued_at, created_at) as invoice_date
      FROM public.delivery_invoices
      WHERE owner_user_id = v_employee_record.owner_user_id
        AND partner = 'alwaseet'
    ),
    to_delete AS (
      SELECT id FROM ranked_invoices 
      WHERE rn > p_keep_count 
        AND invoice_date < v_recent_cutoff  -- لا نحذف الفواتير الحديثة حتى لو تجاوزت العدد المحدد
    ),
    deleted AS (
      DELETE FROM public.delivery_invoices 
      WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_total_deleted FROM deleted;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_deleted', v_total_deleted,
    'kept_per_employee', p_keep_count,
    'kept_recent_days', p_keep_recent_days,
    'cleanup_timestamp', now(),
    'message', format('تم حذف %s فاتورة قديمة، مع الاحتفاظ بآخر %s فاتورة لكل موظف والفواتير من آخر %s أيام', 
                     v_total_deleted, p_keep_count, p_keep_recent_days)
  );
END;
$function$;