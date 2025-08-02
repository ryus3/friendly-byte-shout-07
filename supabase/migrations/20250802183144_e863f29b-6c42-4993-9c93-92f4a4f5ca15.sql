-- تحديث منطق المخزون المحجوز في الدالة
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger AS $$
DECLARE
  item_record RECORD;
  old_status TEXT := OLD.status;
  new_status TEXT := NEW.status;
BEGIN
  -- منطق المخزون المحجوز
  -- الحالات التي يبقى فيها المخزون محجوز: pending, shipped, out_for_delivery, returned
  -- الحالات التي يرجع فيها المخزون للمتاح: cancelled, returned_in_stock  
  -- الحالات التي يصبح فيها مباع: completed, delivered
  
  -- عند إلغاء الطلب أو إرجاعه للمخزن - تحرير المخزون المحجوز
  IF new_status IN ('cancelled', 'returned_in_stock') AND old_status IN ('pending', 'shipped', 'out_for_delivery', 'returned') THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- تحرير المخزون المحجوز
      UPDATE public.inventory 
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
    
    -- أرشفة الطلب إذا كان راجع للمخزن
    IF new_status = 'returned_in_stock' THEN
      NEW.isArchived = true;
    END IF;
  END IF;
  
  -- عند إكمال الطلب - تحويل المحجوز إلى مباع وتقليل المخزون
  IF new_status IN ('completed', 'delivered') AND old_status IN ('pending', 'shipped', 'out_for_delivery', 'returned') THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- تقليل المخزون المحجوز والعادي وزيادة المباع
      UPDATE public.inventory 
      SET 
        quantity = GREATEST(0, quantity - item_record.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
        sold_quantity = COALESCE(sold_quantity, 0) + item_record.quantity,
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
      
      -- تحديث الكمية المباعة في جدول المتغيرات
      UPDATE public.product_variants
      SET sold_quantity = COALESCE(sold_quantity, 0) + item_record.quantity
      WHERE product_id = item_record.product_id 
      AND (id = item_record.variant_id OR (item_record.variant_id IS NULL));
    END LOOP;
    
    -- حساب الأرباح
    PERFORM public.calculate_order_profits(NEW.id);
  END IF;
  
  -- إضافة إشعار واحد فقط لتغيير حالة الطلب
  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data,
    user_id
  ) VALUES (
    'تحديث حالة الطلب',
    'تم تحديث حالة الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' إلى ' || 
    CASE new_status
      WHEN 'pending' THEN 'قيد التجهيز'
      WHEN 'shipped' THEN 'تم الشحن'
      WHEN 'out_for_delivery' THEN 'قيد التوصيل'
      WHEN 'delivered' THEN 'تم التوصيل'
      WHEN 'completed' THEN 'مكتمل'
      WHEN 'cancelled' THEN 'ملغي'
      WHEN 'returned' THEN 'راجع'
      WHEN 'returned_in_stock' THEN 'راجع للمخزن'
      ELSE new_status
    END,
    'order_status_update',
    'medium',
    jsonb_build_object(
      'order_id', NEW.id, 
      'order_number', NEW.order_number,
      'old_status', old_status,
      'new_status', new_status,
      'customer_name', NEW.customer_name
    ),
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;