
-- Helper function to count jsonb object keys
CREATE OR REPLACE FUNCTION public.jsonb_object_keys_count(j jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(*)::integer FROM jsonb_object_keys(j);
$$;

-- =====================================================
-- 1. إصلاح auto_link_dio_to_order: البحث بـ tracking_number أو delivery_partner_order_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_link_dio_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_received_at timestamptz;
  v_owner_user_id uuid;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_order_id
  FROM orders
  WHERE tracking_number = NEW.external_order_id
    AND status IN ('delivered', 'completed', 'partial_delivery')
    AND delivery_status IN ('4', '5', '21')
  LIMIT 1;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM orders
    WHERE delivery_partner_order_id = NEW.external_order_id
      AND status IN ('delivered', 'completed', 'partial_delivery')
      AND delivery_status IN ('4', '5', '21')
    LIMIT 1;
  END IF;

  IF v_order_id IS NOT NULL THEN
    NEW.order_id := v_order_id;
    
    SELECT received_at, owner_user_id 
    INTO v_received_at, v_owner_user_id
    FROM delivery_invoices 
    WHERE id = NEW.invoice_id;
    
    UPDATE orders
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(receipt_received_at, v_received_at, now()),
      receipt_received_by = COALESCE(receipt_received_by, v_owner_user_id),
      delivery_partner_invoice_id = (SELECT external_id FROM delivery_invoices WHERE id = NEW.invoice_id)
    WHERE id = v_order_id
      AND (receipt_received IS NULL OR receipt_received = false);
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. دالة self-healing
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_invoice_orders_from_local_orders(p_invoice_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_id text;
  v_partner text;
  v_owner_user_id uuid;
  v_count integer := 0;
BEGIN
  SELECT external_id, partner, owner_user_id 
  INTO v_external_id, v_partner, v_owner_user_id
  FROM delivery_invoices WHERE id = p_invoice_id;

  IF v_external_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO delivery_invoice_orders (invoice_id, external_order_id, order_id, amount, raw, owner_user_id)
  SELECT 
    p_invoice_id,
    COALESCE(o.tracking_number, o.delivery_partner_order_id),
    o.id,
    o.final_amount,
    jsonb_build_object('id', COALESCE(o.tracking_number, o.delivery_partner_order_id), 'price', o.final_amount, 'client_name', o.customer_name),
    v_owner_user_id
  FROM orders o
  WHERE o.delivery_partner_invoice_id = v_external_id
    AND o.delivery_partner = v_partner
    AND o.status IN ('delivered', 'completed', 'partial_delivery')
    AND NOT EXISTS (
      SELECT 1 FROM delivery_invoice_orders dio 
      WHERE dio.invoice_id = p_invoice_id AND dio.order_id = o.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- 3. إعادة كتابة record_order_revenue_on_receipt
-- =====================================================
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_amount NUMERIC;
  v_delivery_fee NUMERIC;
  v_item RECORD;
  v_owner_id UUID;
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_owner_amounts JSONB := '{}';
  v_owner_key TEXT;
  v_owner_total NUMERIC;
  v_items_total NUMERIC := 0;
  v_item_amount NUMERIC;
  v_has_fc BOOLEAN;
  v_keys_count INTEGER;
BEGIN
  IF NEW.receipt_received = true AND (OLD.receipt_received IS NULL OR OLD.receipt_received = false) THEN
    IF NEW.status IN ('returned', 'cancelled', 'rejected') THEN
      RETURN NEW;
    END IF;
    
    IF EXISTS(SELECT 1 FROM cash_movements WHERE reference_type = 'order' AND reference_id = NEW.id AND movement_type = 'in') THEN
      RETURN NEW;
    END IF;
    
    v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    v_sales_amount := NEW.final_amount - v_delivery_fee;
    
    -- تجميع المبالغ حسب مالك المنتج
    IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' AND jsonb_array_length(NEW.items) > 0 THEN
      FOR v_item IN 
        SELECT 
          COALESCE(p.owner_user_id::text, '__system__') as owner,
          SUM(
            COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, 1)
          ) as item_total
        FROM jsonb_array_elements(NEW.items) AS item
        LEFT JOIN products p ON p.id = COALESCE(
          NULLIF(item->>'product_id', '')::uuid,
          NULLIF(item->>'productId', '')::uuid
        )
        GROUP BY COALESCE(p.owner_user_id::text, '__system__')
      LOOP
        v_owner_amounts := v_owner_amounts || jsonb_build_object(v_item.owner, v_item.item_total);
        v_items_total := v_items_total + v_item.item_total;
      END LOOP;
    END IF;

    v_keys_count := jsonb_object_keys_count(v_owner_amounts);

    IF v_items_total = 0 OR v_keys_count <= 1 THEN
      v_owner_id := NULL;
      
      IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' AND jsonb_array_length(NEW.items) > 0 THEN
        SELECT DISTINCT p.owner_user_id INTO v_owner_id
        FROM jsonb_array_elements(NEW.items) AS item
        JOIN products p ON p.id = COALESCE(
          NULLIF(item->>'product_id', '')::uuid,
          NULLIF(item->>'productId', '')::uuid
        )
        WHERE p.owner_user_id IS NOT NULL
        LIMIT 1;
      END IF;
      
      IF v_owner_id IS NOT NULL THEN
        SELECT id INTO v_cash_source_id FROM cash_sources 
        WHERE owner_user_id = v_owner_id AND is_active = true LIMIT 1;
      END IF;
      
      IF v_cash_source_id IS NULL THEN
        SELECT has_financial_center INTO v_has_fc FROM profiles WHERE user_id = NEW.created_by;
        IF v_has_fc = true THEN
          SELECT id INTO v_cash_source_id FROM cash_sources 
          WHERE owner_user_id = NEW.created_by AND is_active = true LIMIT 1;
        END IF;
      END IF;
      
      IF v_cash_source_id IS NULL THEN
        SELECT id INTO v_cash_source_id FROM cash_sources 
        WHERE is_active = true AND (owner_user_id IS NULL OR name = 'القاصة الرئيسية')
        ORDER BY created_at LIMIT 1;
      END IF;
      
      IF v_cash_source_id IS NULL THEN
        RAISE EXCEPTION 'لا يوجد مصدر نقد نشط';
      END IF;
      
      SELECT current_balance INTO v_balance_before FROM cash_sources WHERE id = v_cash_source_id;
      v_balance_after := v_balance_before + v_sales_amount;
      
      INSERT INTO cash_movements (cash_source_id, movement_type, reference_type, reference_id, amount, balance_before, balance_after, description, created_by, effective_at)
      VALUES (v_cash_source_id, 'in', 'order', NEW.id, v_sales_amount, v_balance_before, v_balance_after,
        'إيراد من طلب ' || COALESCE(NEW.tracking_number, NEW.order_number), 
        COALESCE(NEW.receipt_received_by, NEW.created_by), 
        COALESCE(NEW.receipt_received_at, now()));
      
      UPDATE cash_sources SET current_balance = v_balance_after WHERE id = v_cash_source_id;
    ELSE
      -- عدة ملاك: تقسيم الإيراد نسبياً
      FOR v_owner_key IN SELECT jsonb_object_keys(v_owner_amounts)
      LOOP
        v_owner_total := (v_owner_amounts->>v_owner_key)::numeric;
        v_item_amount := (v_owner_total / v_items_total) * v_sales_amount;
        
        v_cash_source_id := NULL;
        
        IF v_owner_key != '__system__' THEN
          SELECT id INTO v_cash_source_id FROM cash_sources 
          WHERE owner_user_id = v_owner_key::uuid AND is_active = true LIMIT 1;
        END IF;
        
        IF v_cash_source_id IS NULL THEN
          SELECT id INTO v_cash_source_id FROM cash_sources 
          WHERE is_active = true AND (owner_user_id IS NULL OR name = 'القاصة الرئيسية')
          ORDER BY created_at LIMIT 1;
        END IF;
        
        IF v_cash_source_id IS NULL THEN
          RAISE EXCEPTION 'لا يوجد مصدر نقد نشط';
        END IF;
        
        SELECT current_balance INTO v_balance_before FROM cash_sources WHERE id = v_cash_source_id;
        v_balance_after := v_balance_before + v_item_amount;
        
        INSERT INTO cash_movements (cash_source_id, movement_type, reference_type, reference_id, amount, balance_before, balance_after, description, created_by, effective_at)
        VALUES (v_cash_source_id, 'in', 'order', NEW.id, v_item_amount, v_balance_before, v_balance_after,
          'إيراد من طلب ' || COALESCE(NEW.tracking_number, NEW.order_number) || ' (جزئي)',
          COALESCE(NEW.receipt_received_by, NEW.created_by),
          COALESCE(NEW.receipt_received_at, now()));
        
        UPDATE cash_sources SET current_balance = v_balance_after WHERE id = v_cash_source_id;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- 4. إضافة owner_user_id لجدول settlement_invoices
-- =====================================================
ALTER TABLE public.settlement_invoices 
ADD COLUMN IF NOT EXISTS owner_user_id uuid;

-- =====================================================
-- 5. إعادة كتابة pay_employee_dues_with_invoice
-- =====================================================
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id uuid,
  p_amount numeric,
  p_order_ids uuid[] DEFAULT NULL,
  p_profit_ids uuid[] DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_paid_by uuid DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_source_id UUID;
  employee_name TEXT;
  invoice_number TEXT;
  settlement_invoice_id UUID;
BEGIN
  IF p_owner_user_id IS NOT NULL THEN
    SELECT id INTO v_cash_source_id FROM cash_sources 
    WHERE owner_user_id = p_owner_user_id AND is_active = true LIMIT 1;
  END IF;
  
  IF v_cash_source_id IS NULL THEN
    SELECT id INTO v_cash_source_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  END IF;
  
  SELECT full_name INTO employee_name FROM profiles WHERE user_id = p_employee_id;

  IF v_cash_source_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مصدر نقد مناسب');
  END IF;
  IF employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الموظف غير موجود');
  END IF;

  invoice_number := public.generate_ry_settlement_invoice_number();

  INSERT INTO settlement_invoices (
    invoice_number, employee_id, employee_name, total_amount, settlement_date,
    description, order_ids, profit_ids, notes, created_by, owner_user_id
  ) VALUES (
    invoice_number, p_employee_id, employee_name, p_amount, now(),
    COALESCE(p_description, 'دفع مستحقات الموظف ' || employee_name),
    p_order_ids, p_profit_ids,
    'فاتورة تسوية - ' || COALESCE(p_description, ''),
    COALESCE(p_paid_by, auth.uid()),
    p_owner_user_id
  ) RETURNING id INTO settlement_invoice_id;

  PERFORM public.update_cash_source_balance(
    v_cash_source_id, p_amount, 'out', 'employee_dues', settlement_invoice_id,
    'دفع مستحقات - فاتورة رقم: ' || invoice_number, COALESCE(p_paid_by, auth.uid())
  );

  INSERT INTO expenses (
    category, expense_type, description, amount, status, created_by,
    approved_by, approved_at, receipt_number, metadata
  ) VALUES (
    'مستحقات الموظفين', 'system',
    'دفع مستحقات الموظف ' || employee_name || ' - فاتورة: ' || invoice_number,
    p_amount, 'approved', COALESCE(p_paid_by, auth.uid()),
    COALESCE(p_paid_by, auth.uid()), now(), invoice_number,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', employee_name,
      'settlement_invoice_id', settlement_invoice_id,
      'settlement_invoice_number', invoice_number,
      'payment_date', now(),
      'payment_type', 'employee_dues',
      'owner_user_id', p_owner_user_id,
      'cash_source_id', v_cash_source_id
    )
  );

  UPDATE profits 
  SET status = 'settled', settled_at = now(), settled_by = COALESCE(p_paid_by, auth.uid())
  WHERE employee_id = p_employee_id AND status IN ('pending', 'invoice_received', 'settlement_requested')
    AND (array_length(p_profit_ids, 1) IS NULL OR id = ANY(p_profit_ids));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || employee_name || ' بنجاح',
    'invoice_number', invoice_number,
    'settlement_invoice_id', settlement_invoice_id,
    'amount', p_amount,
    'employee_name', employee_name,
    'settlement_date', now(),
    'owner_user_id', p_owner_user_id,
    'cash_source_id', v_cash_source_id
  );
END;
$$;

-- =====================================================
-- 6. تحسين upsert_settlement_request_notification
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_settlement_request_notification(
  p_employee_id uuid,
  p_order_ids uuid[],
  p_total_profit numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_name text;
  v_notification_id uuid;
  v_owner_user_id uuid;
  v_result jsonb;
  v_admin_id uuid;
BEGIN
  SELECT full_name INTO v_employee_name
  FROM profiles
  WHERE user_id = p_employee_id;

  SELECT DISTINCT p.owner_user_id INTO v_owner_user_id
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  LEFT JOIN products p ON p.id = COALESCE(
    NULLIF(item->>'product_id', '')::uuid,
    NULLIF(item->>'productId', '')::uuid
  )
  WHERE o.id = ANY(p_order_ids)
    AND p.owner_user_id IS NOT NULL
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    SELECT ur.user_id INTO v_admin_id
    FROM user_roles ur
    WHERE ur.role = 'admin'
    LIMIT 1;
    v_owner_user_id := v_admin_id;
  END IF;

  DELETE FROM notifications
  WHERE type = 'settlement_request'
    AND (data->>'employee_id')::text = p_employee_id::text
    AND (data->>'status')::text IN ('pending', 'settlement_requested');

  INSERT INTO notifications (
    type, title, message, user_id, data, is_read
  ) VALUES (
    'settlement_request',
    'طلب تحاسب جديد 💰',
    'طلب تحاسب من ' || COALESCE(v_employee_name, 'موظف'),
    v_owner_user_id,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', COALESCE(v_employee_name, 'موظف'),
      'order_ids', to_jsonb(p_order_ids),
      'total_profit', p_total_profit,
      'status', 'pending',
      'requested_at', now()::text,
      'owner_user_id', v_owner_user_id
    ),
    false
  )
  RETURNING id INTO v_notification_id;

  v_result := jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id,
    'owner_user_id', v_owner_user_id
  );

  RETURN v_result;
END;
$$;
