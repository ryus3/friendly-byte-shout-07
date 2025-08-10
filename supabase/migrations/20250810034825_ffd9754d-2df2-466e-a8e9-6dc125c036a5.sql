-- Safe, authorized delete for AI orders (Telegram, AI Chat)
CREATE OR REPLACE FUNCTION public.delete_ai_order_safe(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  allowed BOOLEAN := FALSE;
  deleted_count INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.ai_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;

  -- السماح بالحذف إذا كان صاحب الطلب هو المستخدم الحالي (employee_code) أو إذا كان المستخدم مديراً
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND (
        LOWER(pr.employee_code) = LOWER(COALESCE(v_order.created_by, ''))
        OR pr.role IN ('admin','manager','owner','super_admin')
      )
  ) INTO allowed;

  IF NOT allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح بالحذف');
  END IF;

  DELETE FROM public.ai_orders WHERE id = p_order_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', deleted_count = 1);
END;
$$;