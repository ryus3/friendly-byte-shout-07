-- إنشاء الـ trigger المفقود وتحديث الدالة مع نظام الإشعارات

-- تحديث الدالة لتشمل tracking_number والإشعارات
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  main_cash_source_id uuid;
  sales_amount numeric;
  order_description text;
  employee_name text;
  notification_title text;
  notification_message text;
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- للطلبات المحلية: إنشاء رقم فاتورة داخلي تلقائي
    IF LOWER(COALESCE(NEW.delivery_partner, '')) IN ('محلي', 'local', '') OR NEW.delivery_partner IS NULL THEN
      -- إنشاء رقم فاتورة داخلي إذا لم يكن موجوداً
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        NEW.delivery_partner_invoice_id := 'LOCAL-' || COALESCE(NEW.order_number, NEW.id::text);
      END IF;
    ELSE
      -- للطلبات الخارجية: التحقق من وجود رقم فاتورة فعلي
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        RAISE WARNING 'محاولة تعيين receipt_received = true بدون رقم فاتورة للطلب %', COALESCE(NEW.order_number, NEW.id::text);
        NEW.receipt_received := false;
        RETURN NEW;
      END IF;
    END IF;

    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- طلبات المدير فقط تنتقل مباشرة إلى completed عند الاستلام
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
      END IF;
    END IF;

    -- إنشاء حركة نقد تلقائية للقاصة الرئيسية
    BEGIN
      -- الحصول على id القاصة الرئيسية
      SELECT id INTO main_cash_source_id
      FROM public.cash_sources
      WHERE name = 'القاصة الرئيسية' AND is_active = true
      LIMIT 1;

      IF main_cash_source_id IS NOT NULL THEN
        -- حساب مبلغ المبيعات (إجمالي الطلب - أجور التوصيل)
        sales_amount := COALESCE(NEW.final_amount, NEW.total_amount, 0) - COALESCE(NEW.delivery_fee, 0);
        
        -- إنشاء وصف للحركة باستخدام tracking_number
        order_description := 'إيراد من بيع طلب ' || COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text);

        -- إضافة حركة نقد وارد إذا كان المبلغ أكبر من صفر
        IF sales_amount > 0 THEN
          INSERT INTO public.cash_movements (
            cash_source_id,
            amount,
            movement_type,
            description,
            reference_type,
            reference_id,
            created_by,
            balance_before,
            balance_after
          )
          SELECT 
            main_cash_source_id,
            sales_amount,
            'in',
            order_description,
            'order_payment',
            NEW.id,
            COALESCE(NEW.receipt_received_by, NEW.created_by),
            cs.current_balance,
            cs.current_balance + sales_amount
          FROM public.cash_sources cs
          WHERE cs.id = main_cash_source_id;

          -- تحديث رصيد القاصة الرئيسية
          UPDATE public.cash_sources
          SET 
            current_balance = current_balance + sales_amount,
            updated_at = now()
          WHERE id = main_cash_source_id;
          
          RAISE NOTICE 'تم إضافة حركة نقد وارد بمبلغ % للطلب %', sales_amount, COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text);
        END IF;
      ELSE
        RAISE WARNING 'لم يتم العثور على القاصة الرئيسية لإضافة حركة النقد للطلب %', COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'خطأ في إنشاء حركة النقد للطلب %: %', COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text), SQLERRM;
    END;

    -- إرسال إشعار للمدير عند استلام فاتورة من أي موظف
    BEGIN
      -- الحصول على اسم الموظف
      SELECT COALESCE(p.display_name, split_part(u.email, '@', 1), 'غير معروف') INTO employee_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON u.id = p.user_id
      WHERE u.id = NEW.created_by;

      -- إنشاء عنوان ووصف الإشعار
      notification_title := 'تم استلام فاتورة جديدة';
      notification_message := 'تم استلام فاتورة بواسطة ' || COALESCE(employee_name, 'موظف') || 
                             ' - رقم التتبع: ' || COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text) ||
                             ' - رقم الفاتورة: ' || COALESCE(NEW.delivery_partner_invoice_id, 'محلي');

      -- إرسال إشعار للمدير (user_id = null للإشعارات العامة للمديرين)
      INSERT INTO public.notifications (
        type,
        title,
        message,
        user_id,
        data,
        priority,
        is_read
      ) VALUES (
        'invoice_received',
        notification_title,
        notification_message,
        NULL, -- للمديرين
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'invoice_id', NEW.delivery_partner_invoice_id,
          'employee_id', NEW.created_by,
          'employee_name', employee_name,
          'redirect_to', '/employee-tracking?tab=invoices'
        ),
        'medium',
        false
      );

      RAISE NOTICE 'تم إرسال إشعار للمدير بشأن استلام فاتورة الطلب %', COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'خطأ في إرسال إشعار استلام الفاتورة للطلب %: %', COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text), SQLERRM;
    END;
  END IF;

  -- When invoice receipt is set to false, clear the timestamp and related data
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    NEW.receipt_received_at := NULL;
    NEW.receipt_received_by := NULL;
    -- Clear invoice ID when receipt is marked as not received
    NEW.delivery_partner_invoice_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- إنشاء الـ trigger المفقود على جدول orders
DROP TRIGGER IF EXISTS receipt_received_trigger ON public.orders;
CREATE TRIGGER receipt_received_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_received_order();

-- إصلاح الطلبات السابقة التي استُلمت فواتيرها ولم تُسجل حركة نقد
DO $$
DECLARE
  order_record RECORD;
  main_cash_source_id uuid;
  sales_amount numeric;
  order_description text;
BEGIN
  -- الحصول على id القاصة الرئيسية
  SELECT id INTO main_cash_source_id
  FROM public.cash_sources
  WHERE name = 'القاصة الرئيسية' AND is_active = true
  LIMIT 1;

  IF main_cash_source_id IS NOT NULL THEN
    -- البحث عن الطلبات التي استُلمت فواتيرها ولا توجد لها حركة نقد
    FOR order_record IN
      SELECT o.id, o.order_number, o.tracking_number, o.final_amount, o.total_amount, o.delivery_fee, o.created_by
      FROM public.orders o
      WHERE o.receipt_received = true
        AND NOT EXISTS (
          SELECT 1 FROM public.cash_movements cm 
          WHERE cm.reference_id = o.id AND cm.reference_type = 'order_payment'
        )
    LOOP
      -- حساب مبلغ المبيعات
      sales_amount := COALESCE(order_record.final_amount, order_record.total_amount, 0) - COALESCE(order_record.delivery_fee, 0);
      
      IF sales_amount > 0 THEN
        -- إنشاء وصف للحركة
        order_description := 'إيراد من بيع طلب ' || COALESCE(order_record.tracking_number, order_record.order_number, order_record.id::text);

        -- إضافة حركة نقد وارد
        INSERT INTO public.cash_movements (
          cash_source_id,
          amount,
          movement_type,
          description,
          reference_type,
          reference_id,
          created_by,
          balance_before,
          balance_after
        )
        SELECT 
          main_cash_source_id,
          sales_amount,
          'in',
          order_description,
          'order_payment',
          order_record.id,
          order_record.created_by,
          cs.current_balance,
          cs.current_balance + sales_amount
        FROM public.cash_sources cs
        WHERE cs.id = main_cash_source_id;

        -- تحديث رصيد القاصة الرئيسية
        UPDATE public.cash_sources
        SET 
          current_balance = current_balance + sales_amount,
          updated_at = now()
        WHERE id = main_cash_source_id;

        RAISE NOTICE 'تم إصلاح حركة النقد للطلب السابق: % بمبلغ %', 
          COALESCE(order_record.tracking_number, order_record.order_number), sales_amount;
      END IF;
    END LOOP;
  END IF;
END $$;