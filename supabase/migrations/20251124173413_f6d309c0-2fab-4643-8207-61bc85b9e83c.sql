-- =====================================================
-- إصلاح Trigger لتسجيل الإيرادات بدون أجور توصيل
-- =====================================================

DROP TRIGGER IF EXISTS record_order_revenue_on_receipt ON orders;
DROP FUNCTION IF EXISTS record_order_revenue_on_receipt() CASCADE;

CREATE OR REPLACE FUNCTION record_order_revenue_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  main_cash_source_id uuid;
  movement_exists boolean;
  correct_amount numeric;
BEGIN
  -- فقط عند تحديث receipt_received إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    -- ✅ التحقق من وجود حركة نقد مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM cash_movements 
      WHERE reference_type = 'order' 
        AND reference_id = NEW.id::text
        AND movement_type = 'in'
    ) INTO movement_exists;
    
    IF movement_exists THEN
      RETURN NEW; -- حماية: لا تُنشئ حركة مكررة
    END IF;
    
    SELECT id INTO main_cash_source_id
    FROM cash_sources
    WHERE name = 'القاصة الرئيسية'
    LIMIT 1;
    
    IF main_cash_source_id IS NOT NULL THEN
      -- ✅ الحساب الصحيح: المبيعات في القاصة = final_amount - delivery_fee
      correct_amount := NEW.final_amount - COALESCE(NEW.delivery_fee, 0);
      
      -- استخدام RPC لإضافة الحركة بشكل آمن
      PERFORM update_cash_source_balance(
        main_cash_source_id,
        correct_amount, -- ✅ المبلغ الصحيح بدون أجور توصيل
        'in',
        'order',
        NEW.id::text,
        'إيراد بيع طلب ' || COALESCE(NEW.tracking_number, NEW.order_number),
        COALESCE(NEW.receipt_received_by, NEW.created_by)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION record_order_revenue_on_receipt() IS 
'تسجيل إيراد الطلب في القاصة الرئيسية عند استلام الفاتورة.
القاعدة الأساسية: المبيعات في القاصة = final_amount - delivery_fee
(أجور التوصيل تذهب لشركة التوصيل خارج نظام القاصة)';

CREATE TRIGGER record_order_revenue_on_receipt
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_revenue_on_receipt();

COMMENT ON TRIGGER record_order_revenue_on_receipt ON orders IS 
'Trigger محمي ضد التكرار ويسجل المبلغ الصحيح: final_amount - delivery_fee';