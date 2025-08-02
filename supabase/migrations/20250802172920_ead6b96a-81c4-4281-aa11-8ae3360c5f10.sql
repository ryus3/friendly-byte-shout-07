-- إصلاح شامل لمنطق المخزون - الحل الجذري
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

  -- **منطق المخزون المصحح بالكامل:**
  
  -- 1. عند إلغاء الطلب: إطلاق المخزون المحجوز فقط (لا نغير المتاح)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- إطلاق الحجز فقط - المتاح يزيد تلقائياً لأن المحجوز ينقص
      UPDATE public.inventory 
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
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
  
  -- 2. تم الشحن: المخزون يبقى محجوز تماماً (لا نغير أي شيء)
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'تم الشحن',
      'تم شحن الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' - المخزون يبقى محجوز',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  -- 3. قيد التوصيل: المخزون يبقى محجوز تماماً (لا نغير أي شيء)
  IF NEW.status = 'delivery' AND OLD.status != 'delivery' THEN
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'قيد التوصيل',
      'الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' قيد التوصيل - المخزون محجوز',
      'order_delivery',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      'orange'
    );
  END IF;
  
  -- 4. عند تسليم الطلب: تحويل المحجوز إلى مباع (خصم فعلي وإلغاء حجز)
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- الطريقة الصحيحة: خصم من المخزون الفعلي وإلغاء الحجز
      UPDATE public.inventory 
      SET 
        quantity = GREATEST(0, quantity - item_record.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
    
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'تم التسليم',
      'تم تسليم الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وتأكيد البيع',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  -- 5. راجع للمخزن: إرجاع للمخزون الفعلي وإلغاء الحجز
  IF NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- إضافة للمخزون الفعلي وإلغاء أي حجز متبقي
      UPDATE public.inventory 
      SET 
        quantity = quantity + item_record.quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
    
    -- أرشفة الطلب تلقائياً
    NEW.isArchived = true;
    
    -- تنظيف سجلات الأرباح (إن وجدت)
    DELETE FROM public.profits WHERE order_id = NEW.id;
    
    INSERT INTO public.notifications (
      title, message, type, data, user_id, color
    ) VALUES (
      'تم استلام راجع',
      'تم استلام الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وإرجاعه للمخزون المتاح',
      notification_type,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by,
      notification_color
    );
  END IF;
  
  RETURN NEW;
END;
$function$;