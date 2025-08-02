-- إزالة التريجر المزدوج وإنشاء تريجر موحد لتحديث حالة الطلب
DROP TRIGGER IF EXISTS finalize_stock_trigger ON public.orders;
DROP TRIGGER IF EXISTS auto_release_stock_on_order_delete_trigger ON public.orders;

-- إنشاء دالة موحدة لإدارة تحديث حالة الطلبات
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
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
    
    -- إضافة إشعار واحد فقط لاكتمال الطلب
    INSERT INTO public.notifications (
      title, message, type, data, user_id
    ) VALUES (
      'طلب مكتمل',
      'تم إنهاء الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' وتحديث المخزون',
      'order_completed',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  -- عند تحويل الطلب لحالة "راجع للمخزن"
  ELSIF NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock' THEN
    
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- إرجاع المخزون وإلغاء الحجز
      UPDATE public.inventory 
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
      
    END LOOP;
    
    -- إضافة إشعار استلام الراجع
    INSERT INTO public.notifications (
      title, message, type, data, user_id
    ) VALUES (
      'تم استلام راجع',
      'تم استلام الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' في المخزن وإرجاعه للمخزون المتاح',
      'inventory_update',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  -- عند تحويل الطلب لأي حالة أخرى (شحن، توصيل، إلخ)
  ELSIF NEW.status != OLD.status THEN
    
    -- إضافة إشعار تحديث الحالة
    INSERT INTO public.notifications (
      title, message, type, data, user_id
    ) VALUES (
      'تحديث حالة الطلب',
      'تم تحديث حالة الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' إلى: ' || 
      CASE NEW.status 
        WHEN 'shipped' THEN 'تم الشحن'
        WHEN 'pending' THEN 'قيد التجهيز'
        WHEN 'cancelled' THEN 'ملغي'
        WHEN 'returned' THEN 'راجع'
        ELSE NEW.status
      END,
      'order_status_update',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'old_status', OLD.status, 'new_status', NEW.status),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء التريجر الموحد
CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_change();