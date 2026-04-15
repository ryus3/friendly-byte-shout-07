
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
    
    -- تجميع المبالغ حسب مالك المنتج من order_items
    FOR v_item IN 
      SELECT 
        COALESCE(p.owner_user_id::text, '__system__') as owner,
        SUM(COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0)) as item_total
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
      GROUP BY COALESCE(p.owner_user_id::text, '__system__')
    LOOP
      v_owner_amounts := v_owner_amounts || jsonb_build_object(v_item.owner, v_item.item_total);
      v_items_total := v_items_total + v_item.item_total;
    END LOOP;

    v_keys_count := jsonb_object_keys_count(v_owner_amounts);

    IF v_items_total = 0 OR v_keys_count <= 1 THEN
      v_owner_id := NULL;
      
      -- محاولة تحديد المالك من order_items
      IF v_keys_count = 1 THEN
        SELECT (jsonb_object_keys(v_owner_amounts)) INTO v_owner_key;
        IF v_owner_key IS NOT NULL AND v_owner_key != '__system__' THEN
          v_owner_id := v_owner_key::uuid;
        END IF;
      ELSE
        -- fallback: أول منتج له مالك
        SELECT DISTINCT p.owner_user_id INTO v_owner_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id AND p.owner_user_id IS NOT NULL
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
