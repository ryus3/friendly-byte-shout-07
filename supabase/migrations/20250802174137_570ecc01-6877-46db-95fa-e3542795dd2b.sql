-- إصلاح شامل لنظام حجز المخزون
-- 1. إنشاء دالة محدثة لحجز المخزون عند إنشاء الطلب
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(p_product_id uuid, p_variant_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_available INTEGER;
  current_reserved INTEGER;
  current_total INTEGER;
BEGIN
  -- الحصول على المخزون الحالي
  SELECT quantity, reserved_quantity INTO current_total, current_reserved
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  IF current_total IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير موجود في المخزون');
  END IF;
  
  current_available := current_total - COALESCE(current_reserved, 0);
  
  -- التحقق من توفر الكمية
  IF current_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'الكمية المطلوبة غير متوفرة',
      'available', current_available,
      'requested', p_quantity
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
    'reserved_quantity', p_quantity,
    'old_available', current_available,
    'new_available', current_available - p_quantity
  );
END;
$function$;

-- 2. دالة لتحرير المخزون المحجوز
CREATE OR REPLACE FUNCTION public.release_reserved_stock(p_product_id uuid, p_variant_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_reserved INTEGER;
BEGIN
  -- الحصول على المخزون المحجوز الحالي
  SELECT reserved_quantity INTO current_reserved
  FROM public.inventory 
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  IF current_reserved IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المنتج غير موجود في المخزون');
  END IF;
  
  -- تحرير المخزون
  UPDATE public.inventory 
  SET 
    reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id 
  AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
  
  RETURN jsonb_build_object(
    'success', true,
    'released_quantity', p_quantity,
    'old_reserved', current_reserved,
    'new_reserved', GREATEST(0, current_reserved - p_quantity)
  );
END;
$function$;

-- 3. دالة محدثة للتعامل مع تغيير حالة الطلب
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
  notification_color TEXT;
  notification_type TEXT;
BEGIN
  -- تحديد لون ونوع الإشعار حسب الحالة الجديدة
  CASE NEW.status
    WHEN 'shipped' THEN 
      notification_color := 'purple';
      notification_type := 'order_shipped';
    WHEN 'delivery' THEN 
      notification_color := 'blue';
      notification_type := 'order_delivery';
    WHEN 'delivered' THEN 
      notification_color := 'green';
      notification_type := 'order_delivered';
    WHEN 'cancelled' THEN 
      notification_color := 'red';
      notification_type := 'order_cancelled';
    WHEN 'returned_in_stock' THEN 
      notification_color := 'blue';
      notification_type := 'inventory_update';
    ELSE 
      notification_color := 'blue';
      notification_type := 'order_updated';
  END CASE;

  -- منطق المخزون المصحح:
  
  -- 1. عند إلغاء الطلب: إطلاق المخزون المحجوز
  IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'shipped', 'delivery') THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      PERFORM public.release_reserved_stock(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      );
    END LOOP;
    
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'طلب ملغي',
      'تم إلغاء الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وإرجاع المخزون المحجوز للمتاح',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  -- 2. عند التسليم: تحويل من محجوز إلى مباع
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- تحرير المخزون المحجوز
      PERFORM public.release_reserved_stock(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      );
      
      -- إضافة للكمية المباعة
      UPDATE public.inventory 
      SET 
        sold_quantity = COALESCE(sold_quantity, 0) + item_record.quantity,
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
    
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'تم التسليم',
      'تم تسليم الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وتحديث المخزون المباع',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  -- 3. عند إرجاع للمخزن: تحرير المخزون وإعادته للمتاح
  IF NEW.status = 'returned_in_stock' AND OLD.status IN ('returned', 'cancelled') THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- إذا كان مباعاً، تقليل الكمية المباعة
      IF OLD.status = 'delivered' THEN
        UPDATE public.inventory 
        SET 
          sold_quantity = GREATEST(0, COALESCE(sold_quantity, 0) - item_record.quantity),
          updated_at = now()
        WHERE product_id = item_record.product_id 
        AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
      END IF;
      
      -- تحرير أي مخزون محجوز (للأمان)
      PERFORM public.release_reserved_stock(
        item_record.product_id, 
        item_record.variant_id, 
        item_record.quantity
      );
    END LOOP;
    
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'راجع للمخزن',
      'تم إرجاع الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' للمخزون وإتاحته للبيع',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  -- إشعارات أخرى للحالات التي لا تؤثر على المخزون
  IF NEW.status != OLD.status AND NEW.status NOT IN ('cancelled', 'delivered', 'returned_in_stock') THEN
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'تحديث حالة الطلب',
      'تم تحديث حالة الطلب ' || COALESCE(NEW.order_number, NEW.id::text),
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'new_status', NEW.status),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. دالة لحجز المخزون عند إنشاء الطلب
CREATE OR REPLACE FUNCTION public.reserve_stock_on_order_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 5. إعادة إنشاء الـ triggers بالترتيب الصحيح
DROP TRIGGER IF EXISTS update_sold_quantity_trigger ON public.orders;
DROP TRIGGER IF EXISTS handle_order_status_change_trigger ON public.orders;
DROP TRIGGER IF EXISTS reserve_stock_on_order_create_trigger ON public.orders;

-- Trigger لحجز المخزون عند إنشاء الطلب
CREATE TRIGGER reserve_stock_on_order_create_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_stock_on_order_create();

-- Trigger لتحديث المخزون عند تغيير حالة الطلب
CREATE TRIGGER handle_order_status_change_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_order_status_change();

-- 6. إصلاح الطلب الموجود حالياً (ORD000005)
UPDATE public.inventory 
SET reserved_quantity = 1
WHERE product_id = 'a4ab9ce1-d9bc-4a5b-8b90-5e95b4301f94' 
AND variant_id = 'ea8aa124-5ad9-4724-929f-7b85cd12dc18';