-- إصلاح دالة handle_order_loyalty_points لتجنب تضارب التحديثات
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_order_completion_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_loyalty_id UUID;
  points_to_add INTEGER := 50;
  customer_tier_multiplier NUMERIC := 1.0;
BEGIN
  -- تجنب معالجة الطلبات التي تم تحديثها كجزء من عملية مزامنة الفواتير
  IF (NEW.receipt_received IS DISTINCT FROM OLD.receipt_received) 
     AND (NEW.receipt_received = true) THEN
    -- هذا جزء من مزامنة الفواتير، تخطي معالجة الولاء لتجنب التضارب
    RETURN NEW;
  END IF;

  -- معالجة نقاط الولاء فقط عند اكتمال الطلب فعلياً وليس من المزامنة
  IF (NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed') 
     AND (NEW.receipt_received = true) THEN
    
    -- فحص وجود سجل ولاء للعميل
    SELECT cl.id INTO existing_loyalty_id
    FROM public.customer_loyalty cl
    WHERE cl.customer_id = NEW.customer_id;

    IF existing_loyalty_id IS NOT NULL THEN
      -- تحديث سجل الولاء الموجود
      UPDATE public.customer_loyalty 
      SET total_points = total_points + points_to_add,
          total_spent = total_spent + NEW.final_amount,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE customer_id = NEW.customer_id;
    ELSE
      -- إنشاء سجل ولاء جديد
      INSERT INTO public.customer_loyalty (
        customer_id, 
        total_points, 
        total_spent, 
        total_orders
      ) VALUES (
        NEW.customer_id, 
        points_to_add, 
        NEW.final_amount, 
        1
      );
    END IF;

    -- إضافة سجل تاريخ النقاط
    INSERT INTO public.loyalty_points_history (
      customer_id,
      order_id,
      points_earned,
      transaction_type,
      description
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      points_to_add,
      'order_completion',
      'نقاط إكمال الطلب'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- إصلاح منطق الأرشفة ليعتمد على استلام الفاتورة وليس delivery_status
CREATE OR REPLACE FUNCTION public.review_archive_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- أرشفة الطلبات المكتملة التي تم استلام فاتورتها فقط
  UPDATE orders 
  SET isarchived = true, updated_at = now()
  WHERE status = 'completed' 
  AND receipt_received = true 
  AND isarchived = false
  AND delivery_partner_invoice_id IS NOT NULL
  AND id IN (
    SELECT DISTINCT order_id 
    FROM profits 
    WHERE status = 'settled' 
    AND settled_at IS NOT NULL
  );
  
  RAISE NOTICE 'تم مراجعة وتحديث حالة الأرشفة للطلبات المتسواة مع الفواتير المستلمة';
END;
$function$;

-- دالة محسنة لمزامنة الفواتير المستلمة مع تجنب التضارب
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