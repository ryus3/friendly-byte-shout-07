-- Rewrite revenue notification to mirror cash routing logic exactly
CREATE OR REPLACE FUNCTION public.notify_product_owner_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_item_total numeric;
  v_items_total numeric;
  v_sales_amount numeric;
  v_delivery_fee numeric;
  v_owner_amount numeric;
  v_already boolean;
  v_owner_count int;
BEGIN
  IF NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RETURN NEW;
  END IF;

  v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
  v_sales_amount := COALESCE(NEW.final_amount, 0) - v_delivery_fee;

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
    -- Owner share matches cash routing: all sales_amount for single owner,
    -- proportional split for multi-owner.
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
        '💵 إيراد جديد مستلَم',
        'تم استلام فاتورة الطلب ' || COALESCE(NEW.tracking_number, NEW.order_number, '') ||
        ' — إيرادك: ' || COALESCE(v_owner_amount, 0)::bigint::text || ' د.ع',
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', NEW.tracking_number,
          'invoice_id', NEW.delivery_partner_invoice_id,
          'owner_amount', v_owner_amount,
          'final_amount', NEW.final_amount
        ),
        'normal'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Fix existing revenue_received notifications to reflect correct owner amounts
WITH recomputed AS (
  SELECT n.id AS notif_id,
         o.id AS order_id,
         o.tracking_number,
         o.order_number,
         COALESCE(o.final_amount,0) - COALESCE(o.delivery_fee,0) AS sales_amount,
         n.user_id AS owner_id,
         (SELECT COUNT(DISTINCT p.owner_user_id)
            FROM order_items oi JOIN products p ON p.id=oi.product_id
            WHERE oi.order_id=o.id AND p.owner_user_id IS NOT NULL) AS owner_count,
         (SELECT COALESCE(SUM(COALESCE(oi.total_price, oi.unit_price*oi.quantity,0)),0)
            FROM order_items oi JOIN products p ON p.id=oi.product_id
            WHERE oi.order_id=o.id AND p.owner_user_id IS NOT NULL) AS items_total,
         (SELECT COALESCE(SUM(COALESCE(oi.total_price, oi.unit_price*oi.quantity,0)),0)
            FROM order_items oi JOIN products p ON p.id=oi.product_id
            WHERE oi.order_id=o.id AND p.owner_user_id = n.user_id) AS owner_item_total
  FROM notifications n
  JOIN orders o ON o.id::text = (n.data->>'order_id')
  WHERE n.type = 'revenue_received'
)
UPDATE notifications n
SET message = 'تم استلام فاتورة الطلب ' || COALESCE(r.tracking_number, r.order_number, '') ||
              ' — إيرادك: ' ||
              (CASE
                 WHEN r.owner_count <= 1 OR r.items_total <= 0 THEN r.sales_amount
                 ELSE ROUND((r.owner_item_total / r.items_total) * r.sales_amount)
               END)::bigint::text || ' د.ع',
    data = n.data || jsonb_build_object(
      'owner_amount',
      (CASE
         WHEN r.owner_count <= 1 OR r.items_total <= 0 THEN r.sales_amount
         ELSE ROUND((r.owner_item_total / r.items_total) * r.sales_amount)
       END)
    )
FROM recomputed r
WHERE n.id = r.notif_id;