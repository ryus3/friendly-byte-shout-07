-- إصلاح تحذير search_path للدوال
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points(order_amount NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 100 نقطة لكل 1000 دينار
  RETURN FLOOR(order_amount / 1000) * 100;
END;
$$;