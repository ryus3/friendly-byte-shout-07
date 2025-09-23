-- حذف الحركات النقدية الخاطئة من نوع order_payment والاحتفاظ فقط بحركة الطلب 102612839
DELETE FROM cash_movements 
WHERE reference_type = 'order_payment' 
AND (
  description LIKE '%98713588%' OR
  description LIKE '%RYUS-299923%' OR
  description LIKE '%RYUS-059177%' OR
  description LIKE '%RYUS-042031%' OR
  description LIKE '%101264291%' OR
  description LIKE '%98783797%' OR
  description LIKE '%RYUS-415487%'
);

-- إعادة ضبط رصيد القاصة الرئيسية إلى القيمة الصحيحة
-- الرصيد الأصلي 5,185,000 + 15,000 من الطلب الصحيح فقط = 5,200,000
UPDATE cash_sources 
SET current_balance = 5200000
WHERE name = 'القاصة الرئيسية';

-- تحديث دالة handle_receipt_received_order لمنع التكرار
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  main_cash_source_id uuid;
  order_amount numeric;
  tracking_num text;
  employee_name text;
  invoice_description text;
BEGIN
  -- فقط للطلبات التي تم استلام فاتورتها حديثاً
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    -- التأكد من عدم وجود حركة نقد مسبقة لهذا الطلب
    IF EXISTS (
      SELECT 1 FROM cash_movements 
      WHERE reference_type IN ('order_receipt', 'order_payment')
      AND reference_id = NEW.id
    ) THEN
      RAISE NOTICE 'حركة نقد موجودة مسبقاً للطلب %', COALESCE(NEW.order_number, NEW.id::text);
      RETURN NEW;
    END IF;

    -- الحصول على القاصة الرئيسية
    SELECT id INTO main_cash_source_id
    FROM cash_sources
    WHERE name = 'القاصة الرئيسية'
    AND is_active = true
    LIMIT 1;

    IF main_cash_source_id IS NULL THEN
      RAISE NOTICE 'لم يتم العثور على القاصة الرئيسية';
      RETURN NEW;
    END IF;

    -- حساب مبلغ الطلب
    order_amount := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    
    IF order_amount <= 0 THEN
      RAISE NOTICE 'مبلغ الطلب غير صحيح: %', order_amount;
      RETURN NEW;
    END IF;

    -- الحصول على رقم التتبع
    tracking_num := COALESCE(NEW.tracking_number, NEW.order_number, NEW.id::text);

    -- الحصول على اسم الموظف
    SELECT u.email INTO employee_name
    FROM auth.users u
    WHERE u.id = NEW.created_by;

    -- إضافة حركة نقد إيجابية للقاصة الرئيسية
    PERFORM update_cash_source_balance(
      main_cash_source_id,
      order_amount,
      'in',
      'استلام فاتورة الطلب ' || tracking_num
    );

    -- إرسال إشعار للمديرين
    invoice_description := 'تم استلام فاتورة الطلب ' || tracking_num || 
      CASE 
        WHEN employee_name IS NOT NULL THEN ' للموظف ' || COALESCE(employee_name, 'غير محدد')
        ELSE ''
      END ||
      ' بمبلغ ' || order_amount::text || ' د.ع';

    INSERT INTO notifications (
      type, title, message, user_id, data, priority
    ) VALUES (
      'invoice_received',
      'استلام فاتورة جديدة',
      invoice_description,
      NULL,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', tracking_num,
        'amount', order_amount,
        'employee_id', NEW.created_by,
        'employee_name', employee_name
      ),
      'medium'
    );

    RAISE NOTICE 'تم إضافة حركة نقد لاستلام فاتورة الطلب % بمبلغ %', tracking_num, order_amount;
  END IF;

  RETURN NEW;
END;
$function$;