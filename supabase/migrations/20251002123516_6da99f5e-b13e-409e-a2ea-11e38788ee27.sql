-- تعديل دالة process_telegram_order لإضافة أجور التوصيل من settings
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_phone text,
  p_address text,
  p_products_text text,
  p_chat_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phone text;
  v_address text;
  v_customer_name text := 'زبون تليغرام';
  v_city_name text;
  v_region_name text;
  v_product_items jsonb;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_order_id uuid;
  v_success_message text := '';
  v_error_message text := '';
  v_has_unavailable boolean := false;
  v_alternatives_msg text := '';
  v_product_line text;
BEGIN
  -- 1. قراءة أجور التوصيل من settings
  SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee
  FROM public.settings
  WHERE key = 'delivery_fee'
  LIMIT 1;

  RAISE NOTICE '📦 أجور التوصيل من settings: %', v_delivery_fee;

  -- 2. استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_phone);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_phone;
  
  -- 3. استخراج العنوان
  v_address := extract_actual_address(p_address);
  RAISE NOTICE '📍 العنوان المستخرج: %', v_address;
  
  -- 4. استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_products_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;
  
  -- 5. حساب المبلغ الإجمالي والتحقق من التوفر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_msg := COALESCE(v_item->>'alternatives_message', '');
    END IF;
  END LOOP;
  
  -- 6. إضافة أجور التوصيل إلى المبلغ الإجمالي
  v_total_amount := v_total_amount + v_delivery_fee;
  
  RAISE NOTICE '💰 المبلغ الإجمالي (مع التوصيل): %', v_total_amount;
  
  -- 7. إذا كان هناك منتجات غير متوفرة، نرجع رسالة الخطأ فقط
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg,
      'order_id', NULL
    );
  END IF;
  
  -- 8. حفظ الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_address,
    customer_name,
    items,
    total_amount,
    delivery_fee,
    telegram_chat_id,
    original_text,
    order_data,
    status
  ) VALUES (
    v_phone,
    v_address,
    v_customer_name,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    p_chat_id,
    p_products_text,
    jsonb_build_object(
      'phone_input', p_phone,
      'address_input', p_address,
      'products_input', p_products_text
    ),
    'pending'
  ) RETURNING id INTO v_order_id;
  
  -- 9. بناء رسالة النجاح
  v_success_message := '✅ تم استلام طلبك بنجاح!' || E'\n\n';
  v_success_message := v_success_message || '📋 تفاصيل الطلب:' || E'\n';
  v_success_message := v_success_message || '👤 الاسم: ' || v_customer_name || E'\n';
  v_success_message := v_success_message || '📞 الهاتف: ' || v_phone || E'\n';
  v_success_message := v_success_message || '📍 العنوان: ' || v_address || E'\n\n';
  
  v_success_message := v_success_message || '🛍️ المنتجات:' || E'\n';
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_product_line := '• ' || (v_item->>'product_name') || 
                     ' - اللون: ' || (v_item->>'color') || 
                     ' - القياس: ' || (v_item->>'size') || 
                     ' - الكمية: ' || (v_item->>'quantity') || 
                     ' - السعر: ' || trim(to_char((v_item->>'total_price')::numeric, 'FM999,999')) || ' د.ع';
    v_success_message := v_success_message || v_product_line || E'\n';
  END LOOP;
  
  v_success_message := v_success_message || E'\n💵 المبلغ الإجمالي: ' || 
                      trim(to_char(v_total_amount, 'FM999,999')) || ' د.ع' || E'\n';
  v_success_message := v_success_message || E'\n⏳ سيتم التواصل معك قريباً لتأكيد الطلب';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message,
    'order_id', v_order_id,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة طلبك. الرجاء المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$function$;