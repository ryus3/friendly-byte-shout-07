-- حذف الدالة والترجر السابق غير الصحيح
DROP TRIGGER IF EXISTS auto_delivery_expense_trigger ON orders;
DROP FUNCTION IF EXISTS public.auto_add_delivery_expense();

-- حذف مصاريف التوصيل المحسوبة خطأ
DELETE FROM expenses WHERE receipt_number LIKE '%-DELIVERY';

-- حذف حركات النقد الخاطئة لمصاريف التوصيل
DELETE FROM cash_movements WHERE reference_type = 'delivery_expense';

-- إنشاء دالة جديدة لحساب التوصيل بالطريقة الصحيحة
CREATE OR REPLACE FUNCTION public.auto_add_delivery_cost()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_id UUID;
  delivery_fee_amount NUMERIC;
BEGIN
  -- فقط عند اكتمال الطلب واستلام الفاتورة
  IF NEW.status = 'completed' AND NEW.receipt_received = true 
     AND OLD.status != 'completed' AND NEW.delivery_fee > 0 THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    
    delivery_fee_amount := NEW.delivery_fee;
    
    -- التحقق من عدم وجود مصروف توصيل مسبق
    IF NOT EXISTS (
      SELECT 1 FROM expenses 
      WHERE receipt_number = NEW.order_number || '-DELIVERY'
    ) THEN
      -- إضافة مصروف التوصيل الكامل (لأن شركة التوصيل تأخذه كاملاً)
      INSERT INTO expenses (
        category,
        expense_type,
        description,
        amount,
        vendor_name,
        receipt_number,
        status,
        created_by,
        approved_by,
        approved_at,
        metadata
      ) VALUES (
        'التوصيل والشحن',
        'operational',
        'رسوم توصيل الطلب ' || NEW.order_number || ' - ' || COALESCE(NEW.delivery_partner, 'محلي'),
        delivery_fee_amount,
        COALESCE(NEW.delivery_partner, 'شركة التوصيل'),
        NEW.order_number || '-DELIVERY',
        'approved',
        NEW.created_by,
        NEW.created_by,
        now(),
        jsonb_build_object(
          'order_id', NEW.id,
          'delivery_fee_total', NEW.delivery_fee,
          'note', 'رسوم التوصيل الكاملة - تؤخذ من قبل شركة التوصيل',
          'auto_created', true
        )
      );
      
      -- خصم رسوم التوصيل من القاصة الرئيسية
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        delivery_fee_amount,
        'out',
        'delivery_fees',
        NEW.id,
        'رسوم توصيل الطلب ' || NEW.order_number || ' - تؤخذ من قبل شركة التوصيل',
        NEW.created_by
      );
      
      RAISE NOTICE 'تم خصم رسوم التوصيل كاملة للطلب %: % د.ع', 
                   NEW.order_number, delivery_fee_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط الدالة الجديدة بجدول الطلبات
CREATE TRIGGER auto_delivery_cost_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_delivery_cost();

-- معالجة الطلبات الموجودة بالطريقة الصحيحة
DO $$
DECLARE
  order_record RECORD;
  main_cash_id UUID;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- معالجة جميع الطلبات المكتملة التي تحتوي على رسوم توصيل
  FOR order_record IN 
    SELECT 
      o.id, 
      o.order_number, 
      o.delivery_fee,
      o.delivery_partner,
      o.created_at,
      o.created_by
    FROM orders o
    WHERE o.status = 'completed'
    AND o.receipt_received = true
    AND o.delivery_fee > 0
    ORDER BY o.created_at
  LOOP
    -- إضافة مصروف التوصيل الكامل
    INSERT INTO expenses (
      category,
      expense_type,
      description,
      amount,
      vendor_name,
      receipt_number,
      status,
      created_by,
      approved_by,
      approved_at,
      metadata
    ) VALUES (
      'التوصيل والشحن',
      'operational',
      'رسوم توصيل الطلب ' || order_record.order_number || ' - ' || COALESCE(order_record.delivery_partner, 'محلي'),
      order_record.delivery_fee,
      COALESCE(order_record.delivery_partner, 'شركة التوصيل'),
      order_record.order_number || '-DELIVERY',
      'approved',
      order_record.created_by,
      order_record.created_by,
      order_record.created_at,
      jsonb_build_object(
        'order_id', order_record.id,
        'delivery_fee_total', order_record.delivery_fee,
        'note', 'رسوم التوصيل الكاملة - تؤخذ من قبل شركة التوصيل',
        'auto_created', true
      )
    );
    
    -- خصم رسوم التوصيل من القاصة الرئيسية
    PERFORM public.update_cash_source_balance(
      main_cash_id,
      order_record.delivery_fee,
      'out',
      'delivery_fees',
      order_record.id,
      'رسوم توصيل الطلب ' || order_record.order_number || ' - تؤخذ من قبل شركة التوصيل',
      order_record.created_by
    );
    
    RAISE NOTICE 'تم خصم رسوم التوصيل كاملة للطلب %: % د.ع', 
                 order_record.order_number, order_record.delivery_fee;
  END LOOP;
  
  RAISE NOTICE 'تم الانتهاء من معالجة رسوم التوصيل بالطريقة الصحيحة';
END $$;