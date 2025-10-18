-- دالة لإصلاح price_increase الخاطئ في الطلبات الموجودة
CREATE OR REPLACE FUNCTION fix_incorrect_price_increase_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  fixed_count INTEGER := 0;
  order_record RECORD;
  should_be_zero BOOLEAN;
BEGIN
  -- البحث عن الطلبات المتضررة
  FOR order_record IN 
    SELECT 
      id,
      order_number,
      total_amount,
      final_amount,
      delivery_fee,
      price_increase,
      price_change_type,
      created_at
    FROM public.orders
    WHERE price_increase > 0
      AND delivery_partner = 'alwaseet'
      AND created_at > now() - interval '30 days'
  LOOP
    -- التحقق: final_amount يجب أن يساوي total_amount + delivery_fee (بدون زيادة)
    should_be_zero := (
      (COALESCE(order_record.final_amount, 0)) = 
      (COALESCE(order_record.total_amount, 0) + COALESCE(order_record.delivery_fee, 0))
    );
    
    IF should_be_zero THEN
      UPDATE public.orders
      SET 
        price_increase = 0,
        price_change_type = NULL,
        updated_at = now()
      WHERE id = order_record.id;
      
      fixed_count := fixed_count + 1;
      RAISE NOTICE 'تم إصلاح الطلب %: price_increase من % إلى 0', 
        order_record.order_number, order_record.price_increase;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', fixed_count,
    'message', 'تم إصلاح ' || fixed_count || ' طلب بنجاح'
  );
END;
$$;