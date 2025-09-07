
-- 1) دالة لعمل upsert لإشعار "طلب تحاسب" للمديرين فقط، مع دمج الطلبات وتحديث الإجمالي
CREATE OR REPLACE FUNCTION public.upsert_settlement_request_notification(
  p_employee_id uuid,
  p_order_ids uuid[],
  p_total_profit numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_existing record;
  v_employee_name text;
  v_new_order_ids uuid[];
  v_total_profit numeric := 0;
  v_count int;
  v_notification record;
BEGIN
  -- اسم الموظف
  SELECT COALESCE(p.full_name, p.username, 'موظف غير معروف')
    INTO v_employee_name
  FROM public.profiles p
  WHERE p.user_id = p_employee_id;

  -- إشعار سابق لنفس الموظف (للإدارة فقط) ولم يتم إقراره/رفضه
  SELECT n.*
    INTO v_existing
  FROM public.notifications n
  WHERE n.type = 'settlement_request'
    AND n.user_id IS NULL
    AND (n.data->>'employee_id')::uuid = p_employee_id
    AND COALESCE(n.data->>'status','pending') <> 'approved'
    AND COALESCE(n.data->>'status','pending') <> 'rejected'
  ORDER BY n.created_at DESC
  LIMIT 1;

  -- دمج order_ids وإزالة التكرارات
  IF v_existing IS NOT NULL THEN
    v_new_order_ids := (
      SELECT array_agg(DISTINCT x)
      FROM unnest(
        COALESCE(
          ARRAY(SELECT (jsonb_array_elements_text(v_existing.data->'order_ids'))::uuid),
          ARRAY[]::uuid[]
        )
        || COALESCE(p_order_ids, ARRAY[]::uuid[])
      ) AS x
    );
  ELSE
    v_new_order_ids := p_order_ids;
  END IF;

  -- احتساب إجمالي الأرباح عبر جدول profits للطلبات المدموجة
  SELECT COALESCE(SUM(COALESCE(pr.employee_profit, pr.profit_amount, 0)), 0)
    INTO v_total_profit
  FROM public.profits pr
  WHERE pr.employee_id = p_employee_id
    AND pr.order_id = ANY(v_new_order_ids)
    AND pr.status IN ('settlement_requested','invoice_received');

  -- احتياط: إن لم نستطع احتساب من الجدول لأي سبب
  IF p_total_profit IS NOT NULL AND v_total_profit = 0 THEN
    v_total_profit := p_total_profit;
  END IF;

  v_count := COALESCE(array_length(v_new_order_ids,1),0);

  IF v_existing IS NOT NULL THEN
    UPDATE public.notifications
       SET title = 'طلب تحاسب',
           message = v_employee_name || ' يطلب التحاسب على ' || v_count || ' طلب بقيمة ' || to_char(v_total_profit, 'FM9999999990') || ' د.ع',
           data = jsonb_build_object(
             'employee_id', p_employee_id,
             'employee_name', v_employee_name,
             'order_ids', to_jsonb(v_new_order_ids),
             'total_profit', v_total_profit,
             'status', 'pending'
           ),
           priority = 'high',
           is_read = false,     -- إعادة تعيينه كغير مقروء عند التحديث
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_notification;
  ELSE
    INSERT INTO public.notifications(type, title, message, user_id, data, priority, is_read)
    VALUES (
      'settlement_request',
      'طلب تحاسب',
      v_employee_name || ' يطلب التحاسب على ' || v_count || ' طلب بقيمة ' || to_char(COALESCE(v_total_profit, p_total_profit, 0), 'FM9999999990') || ' د.ع',
      NULL, -- للمديرين فقط
      jsonb_build_object(
        'employee_id', p_employee_id,
        'employee_name', v_employee_name,
        'order_ids', to_jsonb(v_new_order_ids),
        'total_profit', COALESCE(v_total_profit, p_total_profit, 0),
        'status', 'pending'
      ),
      'high',
      false
    )
    RETURNING * INTO v_notification;
  END IF;

  RETURN jsonb_build_object('success', true, 'notification', row_to_json(v_notification));
END;
$function$;

-- 2) Trigger: عند تغيير حالة الربح إلى 'settlement_requested' يتم إطلاق/تحديث إشعار المدير
CREATE OR REPLACE FUNCTION public.notify_settlement_request_on_profit_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'settlement_requested'
     AND COALESCE(OLD.status, '') <> 'settlement_requested'
  THEN
    PERFORM public.upsert_settlement_request_notification(
      NEW.employee_id,
      ARRAY[NEW.order_id],
      COALESCE(NEW.employee_profit, NEW.profit_amount, 0)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_settlement_request ON public.profits;
CREATE TRIGGER trg_notify_settlement_request
AFTER UPDATE OF status ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.notify_settlement_request_on_profit_update();
