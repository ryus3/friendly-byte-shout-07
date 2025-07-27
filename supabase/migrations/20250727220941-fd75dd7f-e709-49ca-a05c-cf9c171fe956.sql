-- تنظيف فوري لجميع المخزون المحجوز اليتيم
DO $$
DECLARE
  cleanup_count INTEGER := 0;
  cleanup_details TEXT := '';
BEGIN
  -- الحصول على تفاصيل العناصر التي سيتم تنظيفها
  SELECT STRING_AGG(
    p.name || ' (محجوز: ' || i.reserved_quantity || ')', 
    ', '
  ) INTO cleanup_details
  FROM inventory i
  LEFT JOIN products p ON i.product_id = p.id
  WHERE i.reserved_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_id = i.product_id
    AND (oi.variant_id = i.variant_id OR (oi.variant_id IS NULL AND i.variant_id IS NULL))
    AND o.status = 'pending'
  );

  -- تنظيف المخزون المحجوز اليتيم
  UPDATE public.inventory 
  SET 
    reserved_quantity = 0,
    updated_at = now()
  WHERE reserved_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_id = inventory.product_id
    AND (oi.variant_id = inventory.variant_id OR (oi.variant_id IS NULL AND inventory.variant_id IS NULL))
    AND o.status = 'pending'
  );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- إضافة إشعار بالتنظيف الفوري
  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data,
    user_id
  ) VALUES (
    'تنظيف فوري للمخزون المحجوز',
    'تم تنظيف ' || cleanup_count || ' عنصر من المخزون المحجوز اليتيم. المنتجات المنظفة: ' || COALESCE(cleanup_details, 'لا يوجد'),
    'inventory_emergency_cleanup',
    'high',
    jsonb_build_object(
      'cleaned_items', cleanup_count, 
      'trigger', 'emergency_cleanup',
      'cleaned_products', cleanup_details
    ),
    NULL
  );
  
  RAISE NOTICE 'تم تنظيف % عنصر من المخزون المحجوز اليتيم فوراً', cleanup_count;
END $$;