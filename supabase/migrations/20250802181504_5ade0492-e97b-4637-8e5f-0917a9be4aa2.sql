-- إنشاء أو تحديث دالة حجز المخزون
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_stock INTEGER;
  current_reserved INTEGER;
  available_stock INTEGER;
BEGIN
  -- الحصول على المخزون الحالي
  SELECT quantity, COALESCE(reserved_quantity, 0) 
  INTO current_stock, current_reserved
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  IF current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير موجود في المخزون');
  END IF;
  
  available_stock := current_stock - current_reserved;
  
  -- التحقق من توفر المخزون
  IF available_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'المخزون المتاح غير كافي. المتاح: ' || available_stock || ', المطلوب: ' || p_quantity
    );
  END IF;
  
  -- حجز المخزون
  UPDATE public.inventory 
  SET 
    reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity,
    updated_at = now()
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حجز ' || p_quantity || ' قطعة بنجاح',
    'reserved_quantity', p_quantity,
    'new_reserved_total', current_reserved + p_quantity,
    'remaining_available', available_stock - p_quantity
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- تحديث دالة إنشاء الطلب لتستخدم حجز المخزون الجديد
CREATE OR REPLACE FUNCTION public.reserve_stock_on_order_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
  reserve_result jsonb;
BEGIN
  -- حجز المخزون للطلبات الجديدة قيد التجهيز
  IF NEW.status = 'pending' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      SELECT public.reserve_stock_for_order(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      ) INTO reserve_result;
      
      -- في حالة فشل الحجز، نسجل تحذير ولكن لا نلغي الطلب
      IF NOT (reserve_result->>'success')::boolean THEN
        INSERT INTO public.notifications (
          title, message, type, priority, data, user_id
        ) VALUES (
          'تحذير مخزون',
          'فشل حجز مخزون المنتج في الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ': ' || (reserve_result->>'error'),
          'stock_warning',
          'high',
          jsonb_build_object('order_id', NEW.id, 'product_id', item_record.product_id, 'error', reserve_result->>'error'),
          NEW.created_by
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تحديث دالة إنهاء المخزون عند اكتمال الطلب
CREATE OR REPLACE FUNCTION public.finalize_stock_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- عند تحويل الطلب من أي حالة إلى "مكتمل"
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- تحويل المخزون المحجوز إلى مباع وتقليل المخزون الإجمالي
      UPDATE public.inventory 
      SET 
        quantity = GREATEST(0, quantity - item_record.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        sold_quantity = COALESCE(sold_quantity, 0) + item_record.quantity,
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
      
    END LOOP;
    
    -- إضافة إشعار اكتمال الطلب
    INSERT INTO public.notifications (
      title, message, type, data, user_id
    ) VALUES (
      'طلب مكتمل',
      'تم إنهاء الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وتحديث المخزون',
      'order_completed',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;