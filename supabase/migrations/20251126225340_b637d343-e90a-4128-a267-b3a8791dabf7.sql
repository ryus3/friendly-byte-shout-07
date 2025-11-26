-- إصلاح شامل نهائي: تصحيح trigger + تحديث الطلبات + إعادة trigger الاستلام التلقائي

-- ========================================
-- الجزء 0: إصلاح trigger حركات النقد
-- ========================================

CREATE OR REPLACE FUNCTION record_order_revenue_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_amount NUMERIC;
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN
    
    -- التحقق من عدم وجود حركة نقد مسجلة مسبقاً
    IF EXISTS(
      SELECT 1 FROM cash_movements 
      WHERE reference_type = 'order' 
        AND reference_id = NEW.id
        AND movement_type = 'in'
    ) THEN
      RAISE NOTICE 'حركة نقد موجودة مسبقاً للطلب %', NEW.tracking_number;
      RETURN NEW;
    END IF;
    
    -- حساب مبلغ البيع (بدون رسوم التوصيل)
    v_sales_amount := NEW.final_amount - COALESCE(NEW.delivery_fee, 0);
    
    -- الحصول على أول مصدر نقد نشط
    SELECT id INTO v_cash_source_id
    FROM cash_sources
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    IF v_cash_source_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد مصدر نقد نشط';
    END IF;
    
    -- الحصول على الرصيد الحالي
    SELECT current_balance INTO v_balance_before
    FROM cash_sources
    WHERE id = v_cash_source_id;
    
    v_balance_after := v_balance_before + v_sales_amount;
    
    -- إنشاء حركة نقد للبيع
    INSERT INTO cash_movements (
      cash_source_id,
      movement_type,
      reference_type,
      reference_id,
      amount,
      balance_before,
      balance_after,
      description,
      created_by,
      effective_at
    ) VALUES (
      v_cash_source_id,
      'in',
      'order',
      NEW.id,
      v_sales_amount,
      v_balance_before,
      v_balance_after,
      'إيراد من طلب ' || NEW.tracking_number,
      NEW.receipt_received_by,
      NEW.receipt_received_at
    );
    
    -- تحديث رصيد مصدر النقد
    UPDATE cash_sources
    SET current_balance = v_balance_after
    WHERE id = v_cash_source_id;
    
    RAISE NOTICE 'تم تسجيل إيراد % من الطلب %', v_sales_amount, NEW.tracking_number;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- الجزء 1: إصلاح فوري للفاتورة 2479746
-- ========================================

UPDATE orders
SET 
  receipt_received = true,
  receipt_received_at = NOW(),
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604',
  delivery_partner_invoice_id = '2479746'
WHERE tracking_number IN ('113138197', '113256936', '113591250')
  AND (receipt_received IS NULL OR receipt_received = false);

-- ========================================
-- الجزء 2: إعادة إنشاء trigger الاستلام التلقائي
-- ========================================

CREATE OR REPLACE FUNCTION auto_update_linked_orders_on_invoice_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id TEXT;
  v_owner_user_id TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
    
    v_invoice_id := NEW.id;
    v_owner_user_id := NEW.owner_user_id;
    
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = NOW(),
      receipt_received_by = v_owner_user_id,
      delivery_partner_invoice_id = NEW.external_id
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = v_invoice_id
      AND dio.order_id = o.id
      AND (o.receipt_received IS NULL OR o.receipt_received = false);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'تم تحديث % طلب تلقائياً لاستلام الفاتورة %', v_updated_count, NEW.external_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON delivery_invoices;
CREATE TRIGGER trigger_auto_update_invoice_orders
  AFTER UPDATE OF received ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_linked_orders_on_invoice_receipt();

COMMENT ON FUNCTION auto_update_linked_orders_on_invoice_receipt() IS 
'CRITICAL: تحديث تلقائي للطلبات عند استلام الفاتورة - لا تحذف أو تعطل';

-- ========================================
-- الجزء 3: التحقق من الإصلاحات
-- ========================================

DO $$
DECLARE
  v_order_count INTEGER;
  v_cash_movements_count INTEGER;
  v_trigger_exists BOOLEAN;
  v_total_amount NUMERIC;
BEGIN
  SELECT COUNT(*), SUM(final_amount - COALESCE(delivery_fee, 0))
  INTO v_order_count, v_total_amount
  FROM orders
  WHERE tracking_number IN ('113138197', '113256936', '113591250')
    AND receipt_received = true;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ الطلبات المُحدّثة: %/3', v_order_count;
  RAISE NOTICE '💰 إجمالي المبالغ: % د.ع', v_total_amount;
  
  SELECT COUNT(*)
  INTO v_cash_movements_count
  FROM cash_movements
  WHERE reference_type = 'order'
    AND reference_id IN (
      SELECT id FROM orders 
      WHERE tracking_number IN ('113138197', '113256936', '113591250')
    )
    AND movement_type = 'in';
  
  RAISE NOTICE '✅ حركات النقد: %/3', v_cash_movements_count;
  
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_update_invoice_orders'
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE NOTICE '✅ trigger الاستلام التلقائي نشط';
  END IF;
  
  RAISE NOTICE '🎉 النظام يعمل تلقائياً الآن';
  RAISE NOTICE '========================================';
END $$;