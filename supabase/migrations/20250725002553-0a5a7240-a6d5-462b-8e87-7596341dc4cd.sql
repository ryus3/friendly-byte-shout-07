-- تحديث منطق الطلبات لإزالة حالة processing وإضافة منطق جديد للحالات

-- 1. إضافة دالة جديدة لمعالجة حالة "راجع للمخزن"
CREATE OR REPLACE FUNCTION public.handle_returned_in_stock_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- عند تحويل الطلب لحالة "راجع للمخزن"
  IF NEW.status = 'returned_in_stock' AND OLD.status IN ('cancelled', 'returned') THEN
    
    -- 1. إلغاء حجز المخزون وإرجاعه للمخزون المتاح
    PERFORM public.release_stock_for_order(NEW.id);
    
    -- 2. تحويل الطلب للأرشيف تلقائياً
    NEW.isArchived = true;
    
    -- 3. تنظيف سجلات الأرباح (إن وجدت)
    DELETE FROM public.profits WHERE order_id = NEW.id;
    
    -- 4. إضافة إشعار
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

-- إنشاء trigger للدالة الجديدة
DROP TRIGGER IF EXISTS handle_returned_in_stock_trigger ON public.orders;
CREATE TRIGGER handle_returned_in_stock_trigger
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_returned_in_stock_order();

-- 2. إنشاء دالة لإطلاق المخزون المحجوز للطلب
CREATE OR REPLACE FUNCTION public.release_stock_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- إطلاق المخزون المحجوز لكل عنصر في الطلب
  FOR item_record IN 
    SELECT oi.product_id, oi.variant_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- إطلاق المخزون المحجوز
    UPDATE public.inventory 
    SET 
      reserved_quantity = GREATEST(0, reserved_quantity - item_record.quantity),
      updated_at = now()
    WHERE product_id = item_record.product_id 
    AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    
  END LOOP;
  
  RAISE NOTICE 'تم إطلاق المخزون المحجوز للطلب %', p_order_id;
END;
$function$;

-- 3. تحديث دالة معالجة حالات الطلبات الموجودة لإزالة منطق processing
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- عند إلغاء الطلب: إطلاق المخزون المحجوز (لكن عدم إرجاعه للمخزون)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- المخزون يبقى محجوز حتى نستلمه يدوياً ونحوله لـ returned_in_stock
    
    -- إضافة إشعار
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'طلب ملغي',
      'تم إلغاء الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || '. المخزون محجوز في انتظار الاستلام',
      'order_cancelled',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  END IF;
  
  -- عند تحويل الطلب لحالة "راجعة": المخزون يبقى محجوز
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    -- إضافة إشعار
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'طلب راجع',
      'الطلب ' || COALESCE(NEW.order_number, NEW.id::text) || ' راجع من العميل. في انتظار الاستلام',
      'order_returned',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
      NEW.created_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء trigger للدالة المحدثة
DROP TRIGGER IF EXISTS order_status_change_trigger ON public.orders;
CREATE TRIGGER order_status_change_trigger
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_status_change();