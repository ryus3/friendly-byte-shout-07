CREATE OR REPLACE FUNCTION public.notify_product_owner_on_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_item_total numeric;
  v_items_total numeric;
  v_sales_amount numeric;
  v_delivery_fee numeric;
  v_owner_amount numeric;
  v_already boolean;
  v_owner_count int;
  v_creator_uuid uuid;
  v_creator_name text;
  v_creator_email text;
BEGIN
  IF NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RETURN NEW;
  END IF;

  v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
  v_sales_amount := COALESCE(NEW.final_amount, 0) - v_delivery_fee;
  v_creator_uuid := NEW.created_by;

  -- Lookup seller display name from profiles (fallback to email / "غير معروف")
  SELECT full_name, email INTO v_creator_name, v_creator_email
  FROM public.profiles
  WHERE user_id = v_creator_uuid
  LIMIT 1;

  IF v_creator_email = 'ryusbrand@gmail.com'
     OR v_creator_uuid = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
    v_creator_name := 'المدير العام';
  ELSIF v_creator_name IS NULL OR length(trim(v_creator_name)) = 0 THEN
    v_creator_name := COALESCE(v_creator_email, 'غير معروف');
  END IF;

  SELECT COALESCE(SUM(COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0)), 0)
    INTO v_items_total
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
    AND p.owner_user_id IS NOT NULL;

  SELECT COUNT(DISTINCT p.owner_user_id)
    INTO v_owner_count
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
    AND p.owner_user_id IS NOT NULL;

  FOR v_owner, v_item_total IN
    SELECT p.owner_user_id,
           SUM(COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0))
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND p.owner_user_id IS NOT NULL
    GROUP BY p.owner_user_id
  LOOP
    IF v_owner_count <= 1 OR v_items_total <= 0 THEN
      v_owner_amount := v_sales_amount;
    ELSE
      v_owner_amount := ROUND((v_item_total / v_items_total) * v_sales_amount);
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_owner
        AND n.type = 'revenue_received'
        AND (n.data->>'order_id') = NEW.id::text
    ) INTO v_already;

    IF NOT v_already THEN
      INSERT INTO public.notifications (user_id, type, title, message, data, priority)
      VALUES (
        v_owner,
        'revenue_received',
        'إيراد جديد مستلَم',
        'الطلب ' || COALESCE(NEW.tracking_number, NEW.order_number, '') ||
        ' (' || v_creator_name || ') — إيرادك: ' || to_char(COALESCE(v_owner_amount, 0)::bigint, 'FM999,999,999') || ' د.ع',
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', NEW.tracking_number,
          'invoice_id', NEW.delivery_partner_invoice_id,
          'owner_amount', v_owner_amount,
          'final_amount', NEW.final_amount,
          'created_by', v_creator_uuid,
          'created_by_name', v_creator_name
        ),
        'normal'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;