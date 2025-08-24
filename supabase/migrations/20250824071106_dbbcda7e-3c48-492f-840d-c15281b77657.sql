-- نظام إدارة حجز المخزون المتقدم - الإصدار المصحح
-- يتعامل مع حالات الطلبات المختلفة ويدير الحجوزات تلقائياً

-- دالة للتحقق من حالة إرجاع الطلب
CREATE OR REPLACE FUNCTION public.should_release_stock_for_order(
  p_status text,
  p_delivery_status text DEFAULT NULL,
  p_delivery_partner text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- للطلبات المحلية
  IF p_delivery_partner IS NULL OR p_delivery_partner = 'محلي' THEN
    RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
  END IF;

  -- لطلبات الوسيط - التحقق من الحالة الخاصة
  IF LOWER(p_delivery_partner) = 'alwaseet' THEN
    -- فقط الحالات 4 و 17 تحرر المخزون
    RETURN p_delivery_status::text IN ('4', '17');
  END IF;

  -- لشركات التوصيل الأخرى
  IF p_delivery_status IS NOT NULL THEN
    -- الحالات التي تحرر المخزون
    RETURN p_delivery_status ~* 'تسليم|مسلم|deliver|راجع.*المخزن|return.*stock|تم.*الارجاع.*التاجر';
  END IF;

  -- الحالة الافتراضية
  RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
END;
$$;

-- دالة للتحقق من حالة حجز الطلب
CREATE OR REPLACE FUNCTION public.should_keep_reservation_for_order(
  p_status text,
  p_delivery_status text DEFAULT NULL,
  p_delivery_partner text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- إذا كان يجب تحرير المخزون، فلا نحتفظ بالحجز
  IF should_release_stock_for_order(p_status, p_delivery_status, p_delivery_partner) THEN
    RETURN FALSE;
  END IF;

  -- الحالات التي تحتفظ بالحجز - مشمولة الطلبات المعادة
  RETURN p_status IN ('pending', 'shipped', 'delivery', 'returned');
END;
$$;

-- دالة تحديث حالة الحجز للطلب
CREATE OR REPLACE FUNCTION public.update_order_reservation_status(
  p_order_id uuid,
  p_new_status text,
  p_new_delivery_status text DEFAULT NULL,
  p_delivery_partner text DEFAULT NULL
) RETURNS jsonb
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
    -- تحرير المخزون المحجوز
    FOR order_item IN 
      SELECT product_id, variant_id, quantity 
      FROM order_items 
      WHERE order_id = p_order_id
    LOOP
      BEGIN
        PERFORM release_stock_item(
          order_item.product_id,
          order_item.variant_id,
          order_item.quantity
        );
        processed_items := processed_items + 1;
        RAISE NOTICE 'تم تحرير % قطعة من المنتج %', order_item.quantity, order_item.product_id;
      EXCEPTION
        WHEN OTHERS THEN
          error_count := error_count + 1;
          RAISE WARNING 'خطأ في تحرير المخزون للعنصر %: %', order_item.product_id, SQLERRM;
      END;
    END LOOP;
    
    action_performed := 'released';
    
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
      WHEN action_performed = 'released' THEN 'تم تحرير المخزون المحجوز'
      WHEN action_performed = 'reserved' THEN 'تم الاحتفاظ بحجز المخزون'
      ELSE 'لا يوجد تغيير مطلوب في حالة الحجز'
    END
  );
END;
$$;