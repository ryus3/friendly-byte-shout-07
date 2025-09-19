-- حذف الـ triggers المتضاربة مع CASCADE
DROP TRIGGER IF EXISTS handle_order_loyalty_points_trigger ON orders;
DROP TRIGGER IF EXISTS order_loyalty_points_trigger ON orders;
DROP FUNCTION IF EXISTS handle_order_loyalty_points() CASCADE;

-- إنشاء دالة محسنة لمزامنة الفواتير المستلمة مع تجنب التضارب
CREATE OR REPLACE FUNCTION public.sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  order_record RECORD;
  orders_updated INTEGER := 0;
  invoice_record RECORD;
BEGIN
  -- البحث عن الفواتير المستلمة التي لم تتم مزامنة طلباتها
  FOR invoice_record IN 
    SELECT DISTINCT di.external_id, di.id as invoice_id
    FROM delivery_invoices di
    JOIN delivery_invoice_orders dio ON di.id = dio.invoice_id
    JOIN orders o ON dio.order_id = o.id
    WHERE di.received = true 
      AND di.partner = 'alwaseet'
      AND o.receipt_received = false
      AND o.delivery_partner = 'alwaseet'
      AND dio.external_order_id IS NOT NULL
  LOOP
    -- تحديث الطلبات المرتبطة بهذه الفاتورة
    FOR order_record IN
      SELECT DISTINCT o.id, o.order_number, o.created_by
      FROM orders o
      JOIN delivery_invoice_orders dio ON o.id = dio.order_id
      WHERE dio.invoice_id = invoice_record.invoice_id
        AND o.receipt_received = false
        AND o.delivery_partner = 'alwaseet'
    LOOP
      -- تحديث الطلب بمعلومات الفاتورة المستلمة
      UPDATE orders
      SET 
        receipt_received = true,
        receipt_received_at = now(),
        receipt_received_by = COALESCE(order_record.created_by, '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
        delivery_partner_invoice_id = invoice_record.external_id,
        -- للطلبات من المدير: انتقال مباشر إلى completed
        status = CASE 
          WHEN order_record.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
               AND status = 'delivered' 
          THEN 'completed'
          ELSE status
        END,
        updated_at = now()
      WHERE id = order_record.id;
      
      orders_updated := orders_updated + 1;
      
      RAISE NOTICE 'تم تحديث الطلب % باستلام الفاتورة %', 
        order_record.order_number, invoice_record.external_id;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orders_updated', orders_updated,
    'message', 'تم مزامنة ' || orders_updated || ' طلب مع الفواتير المستلمة'
  );
END;
$function$;

-- تشغيل المزامنة فوراً لإصلاح الطلبات الحالية
SELECT sync_recent_received_invoices();

-- إعادة الطلب 102612839 من الأرشيف لأنه لم يستلم فاتورة
UPDATE orders 
SET isarchived = false, updated_at = now()
WHERE order_number = 'ORD000015' 
  AND receipt_received = false;