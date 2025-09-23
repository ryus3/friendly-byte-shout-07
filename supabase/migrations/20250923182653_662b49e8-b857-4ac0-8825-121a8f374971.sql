-- إضافة حركة نقد تلقائية عند استلام الفاتورة
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
        
        -- إنشاء وصف للحركة
        order_description := 'إيراد من بيع طلب ' || COALESCE(NEW.order_number, NEW.id::text);

        -- إضافة حركة نقد وارد إذا كان المبلغ أكبر من صفر
        IF sales_amount > 0 THEN
          PERFORM public.update_cash_source_balance(
            main_cash_source_id,
            sales_amount,
            order_description
          );
          
          RAISE NOTICE 'تم إضافة حركة نقد وارد بمبلغ % للطلب %', sales_amount, COALESCE(NEW.order_number, NEW.id::text);
        END IF;
      ELSE
        RAISE WARNING 'لم يتم العثور على القاصة الرئيسية لإضافة حركة النقد للطلب %', COALESCE(NEW.order_number, NEW.id::text);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'خطأ في إنشاء حركة النقد للطلب %: %', COALESCE(NEW.order_number, NEW.id::text), SQLERRM;
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