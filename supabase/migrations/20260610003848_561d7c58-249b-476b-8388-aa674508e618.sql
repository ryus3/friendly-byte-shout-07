
-- =====================================================
-- Phase 1.1: إصلاح دفع المستحقات + الأخطاء الصامتة
-- =====================================================

-- 1) حذف الـ overload القديم المكرر (سبب الغموض)
DROP FUNCTION IF EXISTS public.pay_employee_dues_with_invoice(uuid, numeric, text, uuid, uuid[], uuid[]);

-- 2) إصلاح update_cash_source_balance: إزالة الـ EXCEPTION WHEN OTHERS الصامت
CREATE OR REPLACE FUNCTION public.update_cash_source_balance(
  p_cash_source_id uuid,
  p_amount numeric,
  p_movement_type text,
  p_reference_type text,
  p_reference_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT ''::text,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
  movement_id UUID;
  v_creator UUID;
BEGIN
  v_creator := COALESCE(p_created_by, auth.uid());
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'update_cash_source_balance: created_by مطلوب (auth.uid() = null و p_created_by = null)';
  END IF;

  SELECT cs.current_balance INTO current_balance
  FROM cash_sources cs WHERE cs.id = p_cash_source_id FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'مصدر النقد غير موجود: %', p_cash_source_id;
  END IF;

  IF p_movement_type = 'in' THEN
    new_balance := current_balance + p_amount;
  ELSIF p_movement_type = 'out' THEN
    new_balance := current_balance - p_amount;
  ELSE
    RAISE EXCEPTION 'نوع الحركة غير صحيح: %', p_movement_type;
  END IF;

  UPDATE cash_sources
  SET current_balance = new_balance, updated_at = now()
  WHERE id = p_cash_source_id;

  INSERT INTO cash_movements (
    cash_source_id, amount, movement_type, reference_type, reference_id,
    description, balance_before, balance_after, created_by
  ) VALUES (
    p_cash_source_id, p_amount, p_movement_type, p_reference_type, p_reference_id,
    p_description, current_balance, new_balance, v_creator
  ) RETURNING id INTO movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', movement_id,
    'old_balance', current_balance,
    'new_balance', new_balance,
    'amount', p_amount
  );
END;
$function$;

-- 3) إعادة كتابة pay_employee_dues_with_invoice الموثوقة
--    التوقيع الموحد الوحيد المتبقي
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id uuid,
  p_amount numeric,
  p_order_ids uuid[] DEFAULT NULL::uuid[],
  p_profit_ids uuid[] DEFAULT NULL::uuid[],
  p_description text DEFAULT NULL::text,
  p_paid_by uuid DEFAULT NULL::uuid,
  p_owner_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_source_id UUID;
  v_cash_source_name TEXT;
  v_resolved_owner UUID := p_owner_user_id;
  v_employee_name TEXT;
  v_invoice_number TEXT;
  v_settlement_invoice_id UUID;
  v_creator UUID;
  v_cash_result JSONB;
BEGIN
  v_creator := COALESCE(p_paid_by, auth.uid());
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تحديد المستخدم (auth.uid = null)';
  END IF;

  SELECT full_name INTO v_employee_name FROM profiles WHERE user_id = p_employee_id;
  IF v_employee_name IS NULL THEN
    RAISE EXCEPTION 'الموظف غير موجود: %', p_employee_id;
  END IF;

  -- استنتاج المالك تلقائياً من الطلبات إذا لم يُمرّر
  IF v_resolved_owner IS NULL AND p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
    SELECT p.owner_user_id INTO v_resolved_owner
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = ANY(p_order_ids) AND p.owner_user_id IS NOT NULL
    GROUP BY p.owner_user_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  END IF;

  -- اختيار قاصة المالك الفعلية، وإلا الرئيسية
  IF v_resolved_owner IS NOT NULL THEN
    SELECT id, name INTO v_cash_source_id, v_cash_source_name
    FROM cash_sources
    WHERE owner_user_id = v_resolved_owner AND is_active = true
    ORDER BY created_at LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN
    SELECT id, name INTO v_cash_source_id, v_cash_source_name
    FROM cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;
  END IF;

  IF v_cash_source_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد مصدر نقد مناسب لدفع المستحقات';
  END IF;

  v_invoice_number := public.generate_ry_settlement_invoice_number();

  INSERT INTO settlement_invoices (
    invoice_number, employee_id, employee_name, total_amount, settlement_date,
    description, order_ids, profit_ids, notes, created_by, owner_user_id
  ) VALUES (
    v_invoice_number, p_employee_id, v_employee_name, p_amount, now(),
    COALESCE(p_description, 'دفع مستحقات الموظف ' || v_employee_name),
    COALESCE(p_order_ids, '{}'::uuid[]),
    COALESCE(p_profit_ids, '{}'::uuid[]),
    'فاتورة تسوية - ' || COALESCE(p_description, ''),
    v_creator, v_resolved_owner
  ) RETURNING id INTO v_settlement_invoice_id;

  -- إنشاء حركة النقد (الآن مع رفع أي خطأ بصراحة)
  v_cash_result := public.update_cash_source_balance(
    v_cash_source_id, p_amount, 'out', 'settlement_invoice', v_settlement_invoice_id,
    'دفع مستحقات الموظف ' || v_employee_name || ' - فاتورة ' || v_invoice_number,
    v_creator
  );

  IF NOT COALESCE((v_cash_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'فشل تحديث رصيد القاصة: %', v_cash_result->>'error';
  END IF;

  -- مصروف توثيقي
  INSERT INTO expenses (
    category, expense_type, description, amount, status, created_by,
    approved_by, approved_at, receipt_number, metadata
  ) VALUES (
    'مستحقات الموظفين', 'system',
    'دفع مستحقات الموظف ' || v_employee_name || ' - فاتورة: ' || v_invoice_number,
    p_amount, 'approved', v_creator, v_creator, now(), v_invoice_number,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', v_employee_name,
      'settlement_invoice_id', v_settlement_invoice_id,
      'settlement_invoice_number', v_invoice_number,
      'payment_date', now(),
      'payment_type', 'employee_dues',
      'owner_user_id', v_resolved_owner,
      'cash_source_id', v_cash_source_id,
      'cash_source_name', v_cash_source_name,
      'cash_movement_id', v_cash_result->>'movement_id'
    )
  );

  -- تسوية الأرباح
  UPDATE profits
  SET status = 'settled', settled_at = now(), settled_by = v_creator
  WHERE employee_id = p_employee_id
    AND status IN ('pending', 'invoice_received', 'settlement_requested')
    AND (p_profit_ids IS NULL OR array_length(p_profit_ids, 1) IS NULL OR id = ANY(p_profit_ids))
    AND (p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL OR order_id = ANY(p_order_ids));

  -- ربط فاتورة التسوية بالطلبات (audit)
  IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
    INSERT INTO settlement_invoice_orders (settlement_invoice_id, order_id, created_at)
    SELECT v_settlement_invoice_id, unnest(p_order_ids), now()
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || v_employee_name || ' بنجاح',
    'invoice_number', v_invoice_number,
    'settlement_invoice_id', v_settlement_invoice_id,
    'amount', p_amount,
    'employee_name', v_employee_name,
    'settlement_date', now(),
    'owner_user_id', v_resolved_owner,
    'cash_source_id', v_cash_source_id,
    'cash_source_name', v_cash_source_name,
    'cash_movement_id', v_cash_result->>'movement_id'
  );
END;
$function$;
