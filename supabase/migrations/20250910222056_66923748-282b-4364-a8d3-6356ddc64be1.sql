-- تحديث الدوال الجديدة لضبط search_path وفق توصيات الأمان
CREATE OR REPLACE FUNCTION public.validate_order_calculations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  items_total NUMERIC := 0;
  correct_final NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO items_total
  FROM order_items 
  WHERE order_id = NEW.id;

  correct_final := items_total + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount, 0);

  IF items_total > 0 THEN
    NEW.total_amount := items_total;
    NEW.final_amount := correct_final;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  order_id_to_update UUID;
  items_total NUMERIC := 0;
  order_delivery_fee NUMERIC := 0;
  order_discount NUMERIC := 0;
  correct_final NUMERIC := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    order_id_to_update := OLD.order_id;
  ELSE
    order_id_to_update := NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(total_price), 0) INTO items_total
  FROM order_items 
  WHERE order_id = order_id_to_update;

  SELECT COALESCE(delivery_fee, 0), COALESCE(discount, 0)
  INTO order_delivery_fee, order_discount
  FROM orders 
  WHERE id = order_id_to_update;

  correct_final := items_total + order_delivery_fee - order_discount;

  UPDATE orders 
  SET 
    total_amount = items_total,
    final_amount = correct_final,
    updated_at = now()
  WHERE id = order_id_to_update;

  RETURN COALESCE(NEW, OLD);
END;
$$;