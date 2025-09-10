-- إصلاح شامل لمشاكل المخزون في طلبات الوسيط

-- 1. إصلاح دالة update_order_reservation_status لتستخدم finalize_stock_item بدلاً من release_stock_item
CREATE OR REPLACE FUNCTION public.update_order_reservation_status(p_order_id uuid, p_new_status text, p_new_delivery_status text DEFAULT NULL::text, p_delivery_partner text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  order_record RECORD;
  order_item RECORD;
  should_release BOOLEAN;
  should_keep BOOLEAN;
  processed_items INTEGER := 0;
  error_count INTEGER := 0;
  action_performed TEXT := 'no_change';
BEGIN
  -- جلب تفاصيل الطلب
  SELECT * INTO order_record
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;

  should_release := should_release_stock_for_order(p_new_status, p_new_delivery_status, p_delivery_partner);
  should_keep := should_keep_reservation_for_order(p_new_status, p_new_delivery_status, p_delivery_partner);

  RAISE NOTICE 'تحديث حجز الطلب %: حالة=%, توصيل=%, شريك=%, تحرير=%, احتفاظ=%', 
               order_record.order_number, p_new_status, p_new_delivery_status, p_delivery_partner, should_release, should_keep;

  IF should_release THEN
    -- خصم فعلي من المخزون (finalize_stock_item بدلاً من release_stock_item)
    FOR order_item IN 
      SELECT product_id, variant_id, quantity 
      FROM order_items 
      WHERE order_id = p_order_id
    LOOP
      BEGIN
        PERFORM finalize_stock_item(
          order_item.product_id,
          order_item.variant_id,
          order_item.quantity
        );
        processed_items := processed_items + 1;
        RAISE NOTICE 'تم خصم % قطعة من المنتج % (خصم فعلي)', order_item.quantity, order_item.product_id;
      EXCEPTION
        WHEN OTHERS THEN
          error_count := error_count + 1;
          RAISE WARNING 'خطأ في خصم المخزون للعنصر %: %', order_item.product_id, SQLERRM;
      END;
    END LOOP;
    
    action_performed := 'finalized';
    
  ELSIF should_keep THEN
    -- التأكد من حجز المخزون (إذا لم يكن محجوزاً بالفعل)
    FOR order_item IN 
      SELECT product_id, variant_id, quantity 
      FROM order_items 
      WHERE order_id = p_order_id
    LOOP
      BEGIN
        PERFORM reserve_stock_for_order(
          order_item.product_id,
          order_item.variant_id,
          order_item.quantity
        );
        processed_items := processed_items + 1;
      EXCEPTION
        WHEN OTHERS THEN
          error_count := error_count + 1;
          RAISE WARNING 'تحذير: تعذر إعادة حجز المخزون للعنصر %: %', order_item.product_id, SQLERRM;
      END;
    END LOOP;
    
    action_performed := 'reserved';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', action_performed,
    'processed_items', processed_items,
    'error_count', error_count,
    'message', CASE 
      WHEN action_performed = 'finalized' THEN 'تم خصم المخزون فعلياً من الكمية المتاحة'
      WHEN action_performed = 'reserved' THEN 'تم الاحتفاظ بحجز المخزون'
      ELSE 'لا يوجد تغيير مطلوب في حالة الحجز'
    END
  );
END;
$function$;

-- 2. دالة لإصلاح طلب محدد بالرقم التتبع
CREATE OR REPLACE FUNCTION public.fix_alwaseet_order_stock(p_tracking_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_variant RECORD;
  fixed_items INTEGER := 0;
  total_items INTEGER := 0;
BEGIN
  -- البحث عن الطلب
  SELECT * INTO v_order
  FROM orders 
  WHERE tracking_number = p_tracking_number 
    OR delivery_partner_order_id = p_tracking_number
    OR order_number = p_tracking_number
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;
  
  -- معالجة كل عنصر في الطلب
  FOR v_item IN 
    SELECT * FROM order_items WHERE order_id = v_order.id
  LOOP
    total_items := total_items + 1;
    
    -- جلب بيانات المتغير الحالية
    SELECT * INTO v_variant
    FROM inventory 
    WHERE product_id = v_item.product_id 
      AND variant_id = v_item.variant_id;
    
    IF FOUND THEN
      -- إصلاح المخزون إذا كان reserved_quantity سالب أو غير صحيح
      IF v_variant.reserved_quantity < 0 OR 
         (v_order.delivery_status = '4' AND v_variant.reserved_quantity > 0) THEN
        
        UPDATE inventory 
        SET 
          reserved_quantity = GREATEST(0, reserved_quantity + ABS(LEAST(reserved_quantity, 0))),
          sold_quantity = sold_quantity + v_item.quantity,
          quantity = GREATEST(0, quantity - v_item.quantity),
          updated_at = now()
        WHERE product_id = v_item.product_id 
          AND variant_id = v_item.variant_id;
        
        fixed_items := fixed_items + 1;
        
        RAISE NOTICE 'تم إصلاح مخزون المنتج %: خصم % قطعة', v_item.product_id, v_item.quantity;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'tracking_number', p_tracking_number,
    'total_items', total_items,
    'fixed_items', fixed_items,
    'delivery_status', v_order.delivery_status,
    'message', 'تم إصلاح ' || fixed_items || ' عنصر من أصل ' || total_items
  );
END;
$function$;

-- 3. دالة لإصلاح جميع طلبات الوسيط المتضررة
CREATE OR REPLACE FUNCTION public.fix_all_damaged_alwaseet_orders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order RECORD;
  v_result jsonb;
  total_orders INTEGER := 0;
  fixed_orders INTEGER := 0;
  results jsonb[] := '{}';
BEGIN
  -- البحث عن جميع طلبات الوسيط المسلمة في آخر 30 يوم
  FOR v_order IN 
    SELECT DISTINCT o.*, oi.product_id, oi.variant_id, oi.quantity as order_quantity,
           i.quantity, i.reserved_quantity, i.sold_quantity
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN inventory i ON oi.product_id = i.product_id AND oi.variant_id = i.variant_id
    WHERE LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND o.delivery_status = '4'
      AND o.created_at >= now() - interval '30 days'
      AND (i.reserved_quantity < 0 OR i.reserved_quantity > 0)
    ORDER BY o.created_at DESC
  LOOP
    total_orders := total_orders + 1;
    
    -- إصلاح المخزون لهذا المتغير
    IF v_order.reserved_quantity < 0 OR v_order.reserved_quantity > 0 THEN
      UPDATE inventory 
      SET 
        reserved_quantity = 0,
        sold_quantity = COALESCE(sold_quantity, 0) + v_order.order_quantity,
        quantity = GREATEST(0, quantity),
        updated_at = now()
      WHERE product_id = v_order.product_id 
        AND variant_id = v_order.variant_id;
      
      fixed_orders := fixed_orders + 1;
      
      results := results || jsonb_build_object(
        'order_number', v_order.order_number,
        'tracking_number', v_order.tracking_number,
        'product_id', v_order.product_id,
        'fixed_reserved', v_order.reserved_quantity,
        'added_sold', v_order.order_quantity
      );
      
      RAISE NOTICE 'تم إصلاح الطلب %: خصم % من المحجوز، إضافة % للمبيعات', 
                   v_order.order_number, v_order.reserved_quantity, v_order.order_quantity;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_orders_checked', total_orders,
    'orders_fixed', fixed_orders,
    'fixed_details', results,
    'message', 'تم فحص ' || total_orders || ' طلب وإصلاح ' || fixed_orders || ' طلب متضرر'
  );
END;
$function$;