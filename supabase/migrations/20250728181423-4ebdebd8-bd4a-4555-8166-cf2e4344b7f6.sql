-- إضافة مصاريف التوصيل للطلبات المكتملة التي لم يتم احتساب تكلفة التوصيل لها
DO $$
DECLARE
  order_record RECORD;
  main_cash_id UUID;
  delivery_cost_percentage NUMERIC := 0.6; -- 60% من مبلغ التوصيل كتكلفة فعلية
  actual_delivery_cost NUMERIC;
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
      o.created_at
    FROM orders o
    WHERE o.status = 'completed'
    AND o.receipt_received = true
    AND o.delivery_fee > 0
    AND NOT EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.receipt_number = o.order_number || '-DELIVERY'
    )
    ORDER BY o.created_at
  LOOP
    -- حساب التكلفة الفعلية للتوصيل (60% من المبلغ المحصل)
    actual_delivery_cost := order_record.delivery_fee * delivery_cost_percentage;
    
    -- إضافة مصروف التوصيل
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
      'تكلفة توصيل الطلب ' || order_record.order_number || ' - ' || COALESCE(order_record.delivery_partner, 'محلي'),
      actual_delivery_cost,
      COALESCE(order_record.delivery_partner, 'التوصيل المحلي'),
      order_record.order_number || '-DELIVERY',
      'approved',
      '91484496-b887-44f7-9e5d-be9db5567604', -- المدير الأساسي
      '91484496-b887-44f7-9e5d-be9db5567604',
      order_record.created_at,
      jsonb_build_object(
        'order_id', order_record.id,
        'delivery_fee_collected', order_record.delivery_fee,
        'delivery_cost_percentage', delivery_cost_percentage,
        'auto_created', true
      )
    );
    
    -- تحديث رصيد القاصة الرئيسية (خصم تكلفة التوصيل)
    PERFORM public.update_cash_source_balance(
      main_cash_id,
      actual_delivery_cost,
      'out',
      'delivery_expense',
      order_record.id,
      'تكلفة توصيل الطلب ' || order_record.order_number,
      '91484496-b887-44f7-9e5d-be9db5567604'
    );
    
    RAISE NOTICE 'تم إضافة مصروف توصيل للطلب %: % د.ع (من أصل % د.ع)', 
                 order_record.order_number, actual_delivery_cost, order_record.delivery_fee;
  END LOOP;
  
  RAISE NOTICE 'تم الانتهاء من معالجة مصاريف التوصيل';
END $$;

-- إنشاء دالة لمعالجة مصاريف التوصيل تلقائياً للطلبات الجديدة
CREATE OR REPLACE FUNCTION public.auto_add_delivery_expense()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_id UUID;
  delivery_cost_percentage NUMERIC := 0.6; -- 60% من مبلغ التوصيل كتكلفة فعلية
  actual_delivery_cost NUMERIC;
BEGIN
  -- فقط عند اكتمال الطلب واستلام الفاتورة
  IF NEW.status = 'completed' AND NEW.receipt_received = true 
     AND OLD.status != 'completed' AND NEW.delivery_fee > 0 THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    
    -- حساب التكلفة الفعلية للتوصيل
    actual_delivery_cost := NEW.delivery_fee * delivery_cost_percentage;
    
    -- التحقق من عدم وجود مصروف توصيل مسبق
    IF NOT EXISTS (
      SELECT 1 FROM expenses 
      WHERE receipt_number = NEW.order_number || '-DELIVERY'
    ) THEN
      -- إضافة مصروف التوصيل
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
        'تكلفة توصيل الطلب ' || NEW.order_number || ' - ' || COALESCE(NEW.delivery_partner, 'محلي'),
        actual_delivery_cost,
        COALESCE(NEW.delivery_partner, 'التوصيل المحلي'),
        NEW.order_number || '-DELIVERY',
        'approved',
        NEW.created_by,
        NEW.created_by,
        now(),
        jsonb_build_object(
          'order_id', NEW.id,
          'delivery_fee_collected', NEW.delivery_fee,
          'delivery_cost_percentage', delivery_cost_percentage,
          'auto_created', true
        )
      );
      
      -- تحديث رصيد القاصة الرئيسية (خصم تكلفة التوصيل)
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        actual_delivery_cost,
        'out',
        'delivery_expense',
        NEW.id,
        'تكلفة توصيل الطلب ' || NEW.order_number,
        NEW.created_by
      );
      
      RAISE NOTICE 'تم إضافة مصروف توصيل تلقائياً للطلب %: % د.ع', 
                   NEW.order_number, actual_delivery_cost;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط الدالة بجدول الطلبات
DROP TRIGGER IF EXISTS auto_delivery_expense_trigger ON orders;
CREATE TRIGGER auto_delivery_expense_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_delivery_expense();