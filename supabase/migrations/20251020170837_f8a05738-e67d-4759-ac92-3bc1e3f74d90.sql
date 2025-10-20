-- ✅ الخطوة 3: تحديث دالة handle_exchange_price_difference لتسجيل في replacement_history
CREATE OR REPLACE FUNCTION handle_exchange_price_difference(
  p_exchange_order_id uuid,
  p_original_order_id uuid,
  p_price_difference numeric,
  p_delivery_fee numeric,
  p_delivery_partner text,
  p_employee_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- 1. معالجة فرق السعر
  IF p_price_difference > 0 THEN
    -- العميل يدفع أكثر = إيراد للنظام
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id
    ) VALUES (
      'revenue',
      'exchange_price_increase',
      p_price_difference,
      'إيراد من استبدال - فرق سعر موجب (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id,
      p_employee_id
    );
    
  ELSIF p_price_difference < 0 THEN
    -- العميل يأخذ مبلغ = خصم من الطلب الأصلي
    SELECT adjust_profit_for_return(
      p_original_order_id,
      ABS(p_price_difference),
      p_exchange_order_id
    ) INTO v_result;
    
    -- تسجيل كمصروف استبدال
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id
    ) VALUES (
      'expense',
      'exchange_price_decrease',
      ABS(p_price_difference),
      'مصروف استبدال - فرق سعر سالب (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ') - ' || COALESCE(p_delivery_partner, 'شركة التوصيل'),
      'order',
      p_exchange_order_id,
      p_employee_id
    );
  END IF;
  
  -- 2. معالجة رسوم التوصيل
  IF p_delivery_fee > 0 THEN
    -- رسوم توصيل عادية
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'delivery_fee',
      p_delivery_fee,
      'رسوم توصيل استبدال - ' || COALESCE(p_delivery_partner, 'شركة التوصيل') || ' (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id
    );
    
  ELSIF p_delivery_fee < 0 THEN
    -- خصم من فاتورة شركة التوصيل (الشركة تدفع)
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'delivery_partner_payment',
      ABS(p_delivery_fee),
      'خصم من فاتورة ' || COALESCE(p_delivery_partner, 'شركة التوصيل') || ' - استبدال (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id
    );
  END IF;
  
  -- ✅ الخطوة 3: تسجيل في replacement_history
  INSERT INTO replacement_history (
    outgoing_order_id,
    incoming_order_id,
    original_order_id,
    price_difference,
    delivery_fee,
    processed_by,
    status_21_at
  ) VALUES (
    p_exchange_order_id,
    p_exchange_order_id,  -- نفس الطلب يحتوي على المنتجين
    p_original_order_id,
    p_price_difference,
    p_delivery_fee,
    p_employee_id,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'price_difference_handled', p_price_difference,
    'delivery_fee_handled', p_delivery_fee,
    'message', 'تم معالجة الاستبدال بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;