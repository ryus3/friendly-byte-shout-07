-- Create the missing calculate_order_profits function
CREATE OR REPLACE FUNCTION public.calculate_order_profits(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_record RECORD;
  total_revenue NUMERIC := 0;
  total_cost NUMERIC := 0;
  profit_amount NUMERIC := 0;
  employee_profit NUMERIC := 0;
  result jsonb;
BEGIN
  -- Get order details
  SELECT * INTO order_record FROM orders WHERE id = p_order_id;
  
  IF order_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Calculate revenue (excluding delivery fees)
  total_revenue := COALESCE(order_record.total_amount, 0) - COALESCE(order_record.delivery_fee, 0);
  
  -- Calculate cost from order items
  SELECT COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, 0)), 0)
  INTO total_cost
  FROM order_items oi
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  WHERE oi.order_id = p_order_id;
  
  -- Calculate profit
  profit_amount := total_revenue - total_cost;
  
  -- Calculate employee profit (assuming 10% default)
  employee_profit := profit_amount * 0.10;
  
  result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_revenue', total_revenue,
    'total_cost', total_cost,
    'profit_amount', profit_amount,
    'employee_profit', employee_profit,
    'calculated_at', now()
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Add unique index for tracking_number on alwaseet orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_alwaseet_tracking_unique 
ON orders (tracking_number) 
WHERE delivery_partner = 'alwaseet' AND tracking_number IS NOT NULL;

-- Fix order 98831632 - set status to pending if currently unknown
UPDATE orders 
SET status = 'pending',
    updated_at = now()
WHERE tracking_number = '98831632' 
AND delivery_partner = 'alwaseet' 
AND status = 'unknown';

-- Calculate profits for the specific order
SELECT public.calculate_order_profits('bd4f0212-80d9-4454-8885-de137f1e8783');