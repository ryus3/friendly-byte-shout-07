-- ========================================
-- المرحلة 7: تحديث دالة إرجاع المخزون (مع DROP)
-- ========================================

DROP FUNCTION IF EXISTS return_items_to_inventory(uuid);

CREATE OR REPLACE FUNCTION return_items_to_inventory(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_item RECORD;
  v_items_returned integer := 0;
  v_order_type text;
  v_order_number text;
BEGIN
  -- جلب نوع الطلب ورقمه
  SELECT order_type, order_number INTO v_order_type, v_order_number
  FROM orders
  WHERE id = p_order_id;
  
  -- فقط للطلبات المرجعة
  IF v_order_type != 'return' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الطلب ليس طلب إرجاع',
      'order_type', v_order_type
    );
  END IF;
  
  -- جلب عناصر الطلب وإرجاعها للمخزون
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity, oi.product_id, oi.is_return_item, oi.id as item_id
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- التحقق من أنه منتج مُرجع
    IF COALESCE(v_item.is_return_item, false) = true THEN
      -- إضافة للمخزون
      UPDATE product_variants
      SET 
        quantity = quantity + v_item.quantity,
        updated_at = now()
      WHERE id = v_item.variant_id;
      
      -- تسجيل في سجل المخزون
      INSERT INTO inventory_transactions (
        variant_id,
        quantity_change,
        transaction_type,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        v_item.variant_id,
        v_item.quantity,
        'return',
        'order',
        p_order_id,
        'إرجاع للمخزون - طلب #' || v_order_number
      );
      
      v_items_returned := v_items_returned + 1;
      
      RAISE NOTICE 'تم إرجاع منتج % بكمية % للمخزون', v_item.variant_id, v_item.quantity;
    END IF;
  END LOOP;
  
  -- إذا لم يتم إيجاد أي items، تحذير
  IF v_items_returned = 0 THEN
    RAISE WARNING 'لم يتم إيجاد منتجات مرجعة في الطلب % - order_items فارغة أو لا تحتوي is_return_item', v_order_number;
    
    RETURN jsonb_build_object(
      'success', false,
      'warning', 'لم يتم إيجاد منتجات للإرجاع',
      'items_returned', 0,
      'order_id', p_order_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_returned', v_items_returned,
    'order_id', p_order_id,
    'order_number', v_order_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- المرحلة 8: Trigger معالج الحالة 17 (المتكامل)
-- ========================================

CREATE OR REPLACE FUNCTION handle_return_delivery_status_17()
RETURNS trigger AS $$
DECLARE
  v_has_status_21 boolean;
  v_refund_amount numeric;
  v_original_order_id uuid;
  v_profit_result jsonb;
  v_inventory_result jsonb;
  v_cash_result jsonb;
BEGIN
  -- فقط للطلبات المرجعة التي وصلت للحالة 17
  IF NEW.order_type != 'return' OR NEW.delivery_status != '17' THEN
    RETURN NEW;
  END IF;
  
  -- تجنب المعالجة المكررة
  IF OLD.delivery_status = '17' THEN
    RETURN NEW;
  END IF;
  
  -- ✅ التحقق من سلسلة الحالات (21 ← 17)
  v_has_status_21 := check_status_21_before_17(NEW.id);
  
  IF NOT v_has_status_21 THEN
    -- ❌ لا توجد حالة 21 = إلغاء الإرجاع
    UPDATE orders
    SET 
      status = 'cancelled',
      notes = COALESCE(notes, '') || E'\n⚠️ تم إلغاء الإرجاع - لم يتم استلام المنتج من الزبون (لا توجد حالة 21)',
      updated_at = now()
    WHERE id = NEW.id;
    
    -- إشعار للموظف
    INSERT INTO notifications (
      type,
      title,
      message,
      user_id,
      priority
    ) VALUES (
      'return_cancelled_auto',
      'إلغاء إرجاع تلقائي',
      'تم إلغاء طلب الإرجاع #' || NEW.order_number || ' - لم يتم استلام المنتج من الزبون',
      NEW.created_by,
      'high'
    );
    
    RAISE NOTICE 'تم إلغاء طلب الإرجاع % - لا توجد حالة 21', NEW.order_number;
    
    RETURN NEW;
  END IF;
  
  -- ✅ حالة 21 موجودة = إرجاع صحيح، نكمل المعالجة
  v_refund_amount := COALESCE(NEW.refund_amount, 0);
  v_original_order_id := NEW.original_order_id;
  
  -- 1️⃣ معالجة الأرباح
  IF v_original_order_id IS NOT NULL AND v_refund_amount > 0 THEN
    SELECT adjust_profit_for_return_safe(NEW.id, v_original_order_id, v_refund_amount)
    INTO v_profit_result;
    
    IF (v_profit_result->>'success')::boolean = false THEN
      RAISE WARNING 'فشل معالجة الأرباح للإرجاع %: %', NEW.order_number, v_profit_result->>'error';
    END IF;
  END IF;
  
  -- 2️⃣ إرجاع المخزون
  SELECT return_items_to_inventory(NEW.id) INTO v_inventory_result;
  
  IF (v_inventory_result->>'success')::boolean = false THEN
    RAISE WARNING 'فشل إرجاع المخزون للطلب %: %', NEW.order_number, 
      COALESCE(v_inventory_result->>'error', v_inventory_result->>'warning');
  END IF;
  
  -- 3️⃣ تسجيل حركة النقد
  IF v_refund_amount > 0 THEN
    SELECT record_return_cash_movement(NEW.id, v_refund_amount) INTO v_cash_result;
    
    IF (v_cash_result->>'success')::boolean = false THEN
      RAISE WARNING 'فشل تسجيل حركة النقد للإرجاع %: %', NEW.order_number, v_cash_result->>'error';
    END IF;
  END IF;
  
  -- 4️⃣ تحديث حالة الطلب
  UPDATE orders
  SET 
    status = 'completed',
    notes = COALESCE(notes, '') || E'\n✅ تم معالجة الإرجاع بنجاح - حالة 17',
    updated_at = now()
  WHERE id = NEW.id;
  
  -- 5️⃣ إشعار للموظف
  INSERT INTO notifications (
    type,
    title,
    message,
    user_id,
    priority,
    data
  ) VALUES (
    'return_processed',
    'تم معالجة الإرجاع',
    'تم استلام وإرجاع الطلب #' || NEW.order_number || ' بنجاح - المبلغ: ' || v_refund_amount || ' د.ع',
    NEW.created_by,
    'normal',
    jsonb_build_object(
      'order_id', NEW.id,
      'refund_amount', v_refund_amount,
      'profit_result', v_profit_result,
      'inventory_result', v_inventory_result,
      'cash_result', v_cash_result
    )
  );
  
  RAISE NOTICE 'تم معالجة الإرجاع % بنجاح', NEW.order_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS trg_handle_return_delivery_status_17 ON orders;
CREATE TRIGGER trg_handle_return_delivery_status_17
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.delivery_status = '17' AND NEW.order_type = 'return')
  EXECUTE FUNCTION handle_return_delivery_status_17();