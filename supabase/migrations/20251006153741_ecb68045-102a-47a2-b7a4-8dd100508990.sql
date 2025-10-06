-- إصلاح الطلب 106246427 والمنطق المالي

-- 1. حذف الحركات النقدية الخاطئة للطلب 106246427
DELETE FROM cash_movements 
WHERE id IN (
  '229fecc9-3250-4c80-9084-bcb2e4dfc960',
  '8d575fae-a124-4e05-a148-a58447603dd9',
  'a1657576-ee5c-4e9f-a396-5f4f6ff9c62f'
);

-- 2. تصحيح رصيد القاصة الرئيسية (طرح 50,000 التي دخلت بالخطأ)
UPDATE cash_sources
SET current_balance = current_balance - 50000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 3. إصلاح حالة الطلب 106246427
UPDATE orders
SET 
  receipt_received = false,
  receipt_received_at = NULL,
  receipt_received_by = NULL,
  delivery_partner_invoice_id = NULL,
  status = 'delivered',
  isarchived = false,
  updated_at = now()
WHERE id = '22ee06f9-5235-46d9-8da0-370280ece13d';

-- 4. إصلاح حالة الربح
UPDATE profits
SET 
  status = 'pending',
  updated_at = now()
WHERE order_id = '22ee06f9-5235-46d9-8da0-370280ece13d';

-- 5. حذف trigger الخاطئ handle_receipt_received_order مع CASCADE
DROP FUNCTION IF EXISTS handle_receipt_received_order() CASCADE;

-- 6. حذف trigger القديم وإنشاء الجديد
DROP TRIGGER IF EXISTS record_order_revenue_on_receipt ON orders;
DROP FUNCTION IF EXISTS record_order_revenue_on_receipt();

CREATE OR REPLACE FUNCTION record_order_revenue_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  current_balance numeric;
  order_revenue numeric;
  movement_exists boolean;
BEGIN
  -- فقط عند تحديث receipt_received إلى true لأول مرة
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN
    
    -- التحقق من عدم وجود حركة نقدية مسبقة لهذا الطلب
    SELECT EXISTS(
      SELECT 1 FROM cash_movements 
      WHERE reference_type = 'order' 
      AND reference_id = NEW.id
      AND movement_type = 'income'
    ) INTO movement_exists;
    
    -- إذا كانت هناك حركة مسبقة، لا نفعل شيء
    IF movement_exists THEN
      RETURN NEW;
    END IF;
    
    -- الحصول على القاصة الرئيسية
    SELECT id, current_balance INTO main_cash_source_id, current_balance
    FROM cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF main_cash_source_id IS NOT NULL THEN
      -- حساب إيراد الطلب = total_amount فقط (بدون رسوم التوصيل)
      order_revenue := COALESCE(NEW.total_amount, 0);
      
      -- تسجيل الحركة النقدية
      INSERT INTO cash_movements (
        cash_source_id,
        amount,
        movement_type,
        reference_type,
        reference_id,
        balance_before,
        balance_after,
        description,
        created_by
      ) VALUES (
        main_cash_source_id,
        order_revenue,
        'income',
        'order',
        NEW.id,
        current_balance,
        current_balance + order_revenue,
        'تحصيل طلب رقم ' || COALESCE(NEW.order_number, NEW.id::text),
        COALESCE(NEW.created_by, NEW.receipt_received_by)
      );
      
      -- تحديث رصيد القاصة
      UPDATE cash_sources
      SET current_balance = current_balance + order_revenue,
          updated_at = now()
      WHERE id = main_cash_source_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER record_order_revenue_on_receipt
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_revenue_on_receipt();