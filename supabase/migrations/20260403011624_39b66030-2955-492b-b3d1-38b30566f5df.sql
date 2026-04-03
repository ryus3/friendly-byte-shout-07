
DROP FUNCTION IF EXISTS public.upsert_settlement_request_notification(uuid, uuid[], numeric);

CREATE FUNCTION public.upsert_settlement_request_notification(
  p_employee_id uuid,
  p_order_ids uuid[],
  p_total_profit numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_name text;
  v_notification_id uuid;
  v_owner_user_id uuid;
  v_result jsonb;
BEGIN
  SELECT full_name INTO v_employee_name
  FROM profiles
  WHERE user_id = p_employee_id;

  -- تحديد المالك المالي للمنتجات في الطلبات
  SELECT DISTINCT p.owner_user_id INTO v_owner_user_id
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  JOIN products p ON p.id = (item->>'product_id')::uuid
  WHERE o.id = ANY(p_order_ids)
    AND p.owner_user_id IS NOT NULL
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    SELECT DISTINCT p.owner_user_id INTO v_owner_user_id
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
    JOIN products p ON p.id = (item->>'productId')::uuid
    WHERE o.id = ANY(p_order_ids)
      AND p.owner_user_id IS NOT NULL
    LIMIT 1;
  END IF;

  DELETE FROM notifications
  WHERE type = 'settlement_request'
    AND (data->>'employee_id')::text = p_employee_id::text
    AND (data->>'status')::text IN ('pending', 'settlement_requested');

  INSERT INTO notifications (
    type, title, message, user_id, data, is_read
  ) VALUES (
    'settlement_request',
    'طلب تحاسب جديد 💰',
    'طلب تحاسب من ' || COALESCE(v_employee_name, 'موظف'),
    v_owner_user_id,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', COALESCE(v_employee_name, 'موظف'),
      'order_ids', to_jsonb(p_order_ids),
      'total_profit', p_total_profit,
      'status', 'pending',
      'requested_at', now()::text,
      'owner_user_id', v_owner_user_id
    ),
    false
  )
  RETURNING id INTO v_notification_id;

  v_result := jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id,
    'owner_user_id', v_owner_user_id
  );

  RETURN v_result;
END;
$$;
