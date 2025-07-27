-- تحسين دالة معالجة تغيير حالة الطلبات لإدارة المخزون تلقائياً
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- 1. عند إلغاء الطلب: إطلاق المخزون المحجوز فوراً
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- إطلاق المخزون المحجوز فوراً
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE public.inventory 
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
    
    -- إضافة إشعار
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'طلب ملغي',
      'تم إلغاء الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وإرجاع المخزون للمتاح',
      'order_cancelled',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  END IF;
  
  -- 2. عند تسليم الطلب: خصم فعلي من المخزون وإلغاء الحجز
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- خصم من المخزون الفعلي وإلغاء الحجز
      UPDATE public.inventory 
      SET 
        quantity = GREATEST(0, quantity - item_record.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
  END IF;
  
  -- 3. عند تحويل الطلب لحالة "راجع للمخزن": إرجاع للمخزون الفعلي
  IF NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- إرجاع للمخزون الفعلي وإلغاء الحجز
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
    
    -- إضافة إشعار
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'تم استلام راجع',
      'تم استلام الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' في المخزن وإرجاعه للمخزون المتاح',
      'inventory_update',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;