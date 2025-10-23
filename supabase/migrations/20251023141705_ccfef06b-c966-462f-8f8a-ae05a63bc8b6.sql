-- إصلاح نظام حجز المخزون لطلبات الاستبدال
-- المشكلة: كانت الدالة تحجز المنتجات الواردة والصادرة معاً
-- الحل: تصفية item_direction لحجز الصادرة فقط

-- تعديل دالة update_order_reservation_status
CREATE OR REPLACE FUNCTION public.update_order_reservation_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_new_delivery_status TEXT DEFAULT NULL,
  p_delivery_partner TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
    -- خصم فعلي من المخزون (فقط الصادرة والعادية)
    FOR order_item IN 
      SELECT product_id, variant_id, quantity, item_direction
      FROM order_items 
      WHERE order_id = p_order_id
        AND (item_direction IS NULL OR item_direction = 'outgoing')
    LOOP
      BEGIN
        PERFORM finalize_stock_item(
          order_item.product_id,
          order_item.variant_id,
          order_item.quantity
        );
        processed_items := processed_items + 1;
        RAISE NOTICE 'تم خصم % قطعة من المنتج % (اتجاه: %)', 
                     order_item.quantity, order_item.product_id, COALESCE(order_item.item_direction, 'عادي');
      EXCEPTION
        WHEN OTHERS THEN
          error_count := error_count + 1;
          RAISE WARNING 'خطأ في خصم المخزون للعنصر %: %', order_item.product_id, SQLERRM;
      END;
    END LOOP;
    
    action_performed := 'finalized';
    
  ELSIF should_keep THEN
    -- حجز المخزون (فقط الصادرة والعادية)
    FOR order_item IN 
      SELECT product_id, variant_id, quantity, item_direction
      FROM order_items 
      WHERE order_id = p_order_id
        AND (item_direction IS NULL OR item_direction = 'outgoing')
    LOOP
      BEGIN
        PERFORM reserve_stock_for_order(
          order_item.product_id,
          order_item.variant_id,
          order_item.quantity
        );
        processed_items := processed_items + 1;
        RAISE NOTICE 'تم حجز % قطعة من المنتج % (اتجاه: %)', 
                     order_item.quantity, order_item.product_id, COALESCE(order_item.item_direction, 'عادي');
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
      WHEN action_performed = 'finalized' THEN 'تم خصم المخزون فعلياً من الكمية المتاحة (الصادرة فقط)'
      WHEN action_performed = 'reserved' THEN 'تم الاحتفاظ بحجز المخزون (الصادرة فقط)'
      ELSE 'لا يوجد تغيير مطلوب في حالة الحجز'
    END
  );
END;
$$;

-- إصلاح الحجوزات الخاطئة الموجودة حالياً
DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_corrected_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'بدء إصلاح الحجوزات الخاطئة للمنتجات الواردة...';
  
  -- البحث عن طلبات الاستبدال/الاستبدال النشطة
  FOR v_order IN 
    SELECT id, order_number 
    FROM orders 
    WHERE order_type IN ('exchange', 'replacement')
      AND status NOT IN ('cancelled', 'returned', 'completed')
      AND created_at >= now() - interval '90 days'
  LOOP
    -- إلغاء حجز المنتجات الواردة فقط
    FOR v_item IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = v_order.id
        AND oi.item_direction = 'incoming'
    LOOP
      -- إلغاء الحجز الخاطئ
      UPDATE inventory
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
          updated_at = now()
      WHERE product_id = v_item.product_id 
        AND variant_id = v_item.variant_id
        AND reserved_quantity > 0;
      
      IF FOUND THEN
        v_corrected_count := v_corrected_count + 1;
        RAISE NOTICE 'تم إلغاء حجز خاطئ للطلب %: منتج وارد % (كمية: %)', 
                     v_order.order_number, v_item.product_id, v_item.quantity;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'تم إصلاح % حجز خاطئ للمنتجات الواردة', v_corrected_count;
END $$;