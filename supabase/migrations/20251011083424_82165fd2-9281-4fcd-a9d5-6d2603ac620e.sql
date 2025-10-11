-- ========================================
-- المرحلة 3: دوال SQL للمحاسبة الكاملة
-- ========================================

-- 1️⃣ دالة تعديل الأرباح عند الإرجاع
CREATE OR REPLACE FUNCTION adjust_profit_for_return(
  p_original_order_id uuid,
  p_refund_amount numeric,
  p_return_order_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_profit_record RECORD;
  v_employee_refund_share numeric;
  v_system_refund_share numeric;
  v_new_profit numeric;
  v_new_employee_profit numeric;
BEGIN
  -- جلب سجل الربح الأصلي
  SELECT * INTO v_profit_record
  FROM profits
  WHERE order_id = p_original_order_id
  LIMIT 1;
  
  IF v_profit_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على سجل ربح');
  END IF;
  
  -- حساب حصة الموظف من المبلغ المُرجع
  v_employee_refund_share := (v_profit_record.employee_percentage / 100.0) * p_refund_amount;
  v_system_refund_share := p_refund_amount - v_employee_refund_share;
  
  -- حساب الأرباح الجديدة
  v_new_profit := v_profit_record.profit_amount - p_refund_amount;
  v_new_employee_profit := GREATEST(0, v_profit_record.employee_profit - v_employee_refund_share);
  
  -- تحديث سجل الربح
  UPDATE profits
  SET 
    profit_amount = v_new_profit,
    employee_profit = v_new_employee_profit,
    total_revenue = total_revenue - p_refund_amount,
    updated_at = now()
  WHERE id = v_profit_record.id;
  
  -- تسجيل في accounting - حصة الموظف
  IF v_employee_refund_share > 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id
    ) VALUES (
      'expense',
      'employee_refund_deduction',
      v_employee_refund_share,
      'خصم من أرباح الموظف - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id,
      v_profit_record.employee_id
    );
  END IF;
  
  -- تسجيل في accounting - حصة النظام
  IF v_system_refund_share > 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'system_refund',
      v_system_refund_share,
      'خصم من أرباح النظام - إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_return_order_id),
      'order',
      p_return_order_id
    );
  END IF;
  
  -- إذا أصبح الربح سالب، تسجيل كخسارة
  IF v_new_profit < 0 THEN
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'loss_from_return',
      ABS(v_new_profit),
      'خسارة من إرجاع - طلب #' || (SELECT order_number FROM orders WHERE id = p_original_order_id),
      'order',
      p_original_order_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'original_profit', v_profit_record.profit_amount,
    'new_profit', v_new_profit,
    'employee_refund_share', v_employee_refund_share,
    'system_refund_share', v_system_refund_share
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2️⃣ دالة معالجة فرق السعر في الاستبدال
CREATE OR REPLACE FUNCTION handle_exchange_price_difference(
  p_exchange_order_id uuid,
  p_original_order_id uuid,
  p_price_difference numeric,
  p_delivery_fee numeric,
  p_delivery_partner text,
  p_employee_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- 1. معالجة فرق السعر
  IF p_price_difference > 0 THEN
    -- العميل يدفع أكثر = إيراد للنظام
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id
    ) VALUES (
      'revenue',
      'exchange_price_increase',
      p_price_difference,
      'إيراد من استبدال - فرق سعر موجب (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id,
      p_employee_id
    );
    
  ELSIF p_price_difference < 0 THEN
    -- العميل يأخذ مبلغ = خصم من الطلب الأصلي
    SELECT adjust_profit_for_return(
      p_original_order_id,
      ABS(p_price_difference),
      p_exchange_order_id
    ) INTO v_result;
    
    -- تسجيل كمصروف استبدال
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id, employee_id
    ) VALUES (
      'expense',
      'exchange_price_decrease',
      ABS(p_price_difference),
      'مصروف استبدال - فرق سعر سالب (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ') - ' || COALESCE(p_delivery_partner, 'شركة التوصيل'),
      'order',
      p_exchange_order_id,
      p_employee_id
    );
  END IF;
  
  -- 2. معالجة رسوم التوصيل
  IF p_delivery_fee > 0 THEN
    -- رسوم توصيل عادية
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'delivery_fee',
      p_delivery_fee,
      'رسوم توصيل استبدال - ' || COALESCE(p_delivery_partner, 'شركة التوصيل') || ' (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id
    );
    
  ELSIF p_delivery_fee < 0 THEN
    -- خصم من فاتورة شركة التوصيل (الشركة تدفع)
    INSERT INTO accounting (
      type, category, amount, description,
      reference_type, reference_id
    ) VALUES (
      'expense',
      'delivery_partner_payment',
      ABS(p_delivery_fee),
      'خصم من فاتورة ' || COALESCE(p_delivery_partner, 'شركة التوصيل') || ' - استبدال (طلب #' || (SELECT order_number FROM orders WHERE id = p_exchange_order_id) || ')',
      'order',
      p_exchange_order_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'price_difference_handled', p_price_difference,
    'delivery_fee_handled', p_delivery_fee,
    'message', 'تم معالجة الاستبدال بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3️⃣ دالة إرجاع المنتجات للمخزون (للحالة 17)
CREATE OR REPLACE FUNCTION return_items_to_inventory(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_item RECORD;
  v_items_returned integer := 0;
BEGIN
  -- جلب عناصر الطلب وإرجاعها للمخزون
  FOR v_item IN 
    SELECT oi.variant_id, oi.quantity, oi.product_id
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- إضافة للمخزون
    PERFORM update_variant_stock(
      v_item.variant_id,
      v_item.quantity,
      'إرجاع طلب #' || (SELECT order_number FROM orders WHERE id = p_order_id)
    );
    
    v_items_returned := v_items_returned + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_returned', v_items_returned,
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4️⃣ تحديث Trigger للحالة 17
CREATE OR REPLACE FUNCTION process_replacement_inventory_auto()
RETURNS trigger AS $$
BEGIN
  -- إذا كانت الحالة 17 (رجع للتاجر)
  IF NEW.delivery_status = '17' AND OLD.delivery_status IS DISTINCT FROM '17' THEN
    
    -- للطلبات الاستبدالية
    IF NEW.order_type = 'replacement' THEN
      -- إنشاء إشعار للموظف لاختيار المنتجات المستبدلة
      INSERT INTO notifications (
        type, title, message, user_id, data, priority
      ) VALUES (
        'replacement_inventory_needed',
        'استبدال - اختر المنتجات',
        'الطلب #' || COALESCE(NEW.order_number, NEW.id::text) || ' وصل - اختر المنتج الصادر والوارد',
        NEW.created_by,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'adjustment_type', NEW.adjustment_type
        ),
        'high'
      );
    END IF;
    
    -- للطلبات المرجعة (return)
    IF NEW.order_type = 'return' THEN
      -- إرجاع المنتجات للمخزون تلقائياً
      PERFORM return_items_to_inventory(NEW.id);
      
      -- إشعار للموظف
      INSERT INTO notifications (
        type, title, message, user_id, data, priority
      ) VALUES (
        'return_inventory_restored',
        'إرجاع - تم استعادة المخزون',
        'الطلب #' || COALESCE(NEW.order_number, NEW.id::text) || ' - تم إرجاع المنتجات للمخزون',
        NEW.created_by,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number
        ),
        'medium'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;