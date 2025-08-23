-- تحديث الطلب 98783797 لحالة "راجع" مع إعادة حجز المخزون
DO $$
DECLARE
  order_record RECORD;
  item_record RECORD;
BEGIN
  -- التحقق من الطلب المحدد
  SELECT * INTO order_record FROM orders WHERE order_number = '98783797';
  
  IF order_record.id IS NOT NULL THEN
    -- تحديث حالة الطلب من cancelled إلى returned (راجع)
    UPDATE orders 
    SET 
      status = 'returned',
      updated_at = now()
    WHERE id = order_record.id;
    
    RAISE NOTICE 'تم تحديث حالة الطلب 98783797 من cancelled إلى returned';
    
    -- إعادة حجز المخزون للمنتجات في هذا الطلب
    FOR item_record IN 
      SELECT oi.*, pv.sku, p.name as product_name
      FROM order_items oi
      JOIN product_variants pv ON oi.variant_id = pv.id
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = order_record.id
    LOOP
      -- تحديث المخزون المحجوز
      UPDATE inventory 
      SET 
        reserved_quantity = reserved_quantity + item_record.quantity,
        updated_at = now()
      WHERE product_id = item_record.product_id 
      AND variant_id = item_record.variant_id;
      
      RAISE NOTICE 'تم إعادة حجز % قطعة من المنتج % (SKU: %)', 
                   item_record.quantity, 
                   item_record.product_name, 
                   item_record.sku;
    END LOOP;
    
    RAISE NOTICE 'تم تصحيح الطلب 98783797 بنجاح - الحالة: returned، المخزون: محجوز';
  ELSE
    RAISE WARNING 'الطلب 98783797 غير موجود';
  END IF;
END $$;