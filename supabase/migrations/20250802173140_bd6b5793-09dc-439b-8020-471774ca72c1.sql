-- إضافة حقل sold_quantity لتتبع الكمية المباعة
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS sold_quantity INTEGER DEFAULT 0;

-- إنشاء دالة لحساب الكمية المباعة لكل متغير
CREATE OR REPLACE FUNCTION public.calculate_sold_quantity(p_product_id uuid, p_variant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_sold INTEGER := 0;
BEGIN
  -- حساب إجمالي الكمية المباعة من الطلبات المكتملة
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO total_sold
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.product_id = p_product_id
  AND (oi.variant_id = p_variant_id OR (oi.variant_id IS NULL AND p_variant_id IS NULL))
  AND o.status = 'delivered';
  
  RETURN total_sold;
END;
$function$;

-- تحديث جميع السجلات الحالية بالكمية المباعة الصحيحة
UPDATE public.inventory 
SET sold_quantity = public.calculate_sold_quantity(product_id, variant_id)
WHERE sold_quantity = 0;

-- دالة محدثة لتحديث الكمية المباعة عند تغيير حالة الطلب
CREATE OR REPLACE FUNCTION public.update_sold_quantity_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
BEGIN
  -- عند تم التوصيل - زيادة الكمية المباعة
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE public.inventory 
      SET 
        sold_quantity = sold_quantity + item_record.quantity,
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
  END IF;
  
  -- عند إلغاء التوصيل (راجع للمخزن) - تقليل الكمية المباعة
  IF OLD.status = 'delivered' AND NEW.status = 'returned_in_stock' THEN
    FOR item_record IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE public.inventory 
      SET 
        sold_quantity = GREATEST(0, sold_quantity - item_record.quantity),
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND (variant_id = item_record.variant_id OR (variant_id IS NULL AND item_record.variant_id IS NULL));
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إضافة trigger لتحديث الكمية المباعة
DROP TRIGGER IF EXISTS update_sold_quantity_trigger ON public.orders;
CREATE TRIGGER update_sold_quantity_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sold_quantity_on_delivery();