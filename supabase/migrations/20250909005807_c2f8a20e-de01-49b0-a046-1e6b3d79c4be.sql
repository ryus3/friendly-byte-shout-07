-- إصلاح دالة الهجرة لتتوافق مع بنية الجدول الموجود
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expense_by_id(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  e RECORD;
  v_employee_id uuid;
  v_employee_name text;
  v_employee_code text;
  v_total numeric;
  v_invoice_number text;
  v_invoice_id uuid;
  v_orders jsonb;
  v_order_id uuid;
  v_amount numeric;
  v_count int := 0;
BEGIN
  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'expense_not_found');
  END IF;

  -- استخراج بيانات الموظف
  v_employee_id := NULLIF((e.metadata->>'employee_id')::uuid, NULL);
  IF v_employee_id IS NULL THEN
    v_employee_id := e.created_by;
  END IF;
  
  -- الحصول على اسم ورمز الموظف
  SELECT full_name, employee_code INTO v_employee_name, v_employee_code
  FROM public.profiles 
  WHERE user_id = v_employee_id;

  v_total := COALESCE((e.metadata->>'total_amount')::numeric, e.amount, 0);

  -- إنشاء رقم فاتورة فريد
  v_invoice_number := COALESCE(NULLIF(e.receipt_number,''), 'SET-'||to_char(now(),'YYYYMMDD-HH24MI'));
  v_invoice_number := v_invoice_number || '-' || right(e.id::text, 6);

  -- إدراج أو تحديث فاتورة التسوية
  INSERT INTO public.settlement_invoices (
    invoice_number, 
    employee_id, 
    employee_name,
    employee_code,
    total_amount, 
    settlement_date, 
    description, 
    payment_method,
    notes, 
    status,
    created_by
  )
  VALUES (
    v_invoice_number, 
    v_employee_id, 
    COALESCE(v_employee_name, 'غير محدد'),
    v_employee_code,
    v_total, 
    COALESCE(e.approved_at, e.created_at, now()), 
    e.description,
    'expense',
    'تم النقل من المصاريف', 
    COALESCE(e.status,'pending'),
    COALESCE(e.approved_by, e.created_by)
  )
  ON CONFLICT (invoice_number) DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      employee_name = EXCLUDED.employee_name,
      employee_code = EXCLUDED.employee_code,
      total_amount = EXCLUDED.total_amount,
      settlement_date = EXCLUDED.settlement_date,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      updated_at = now()
  RETURNING id INTO v_invoice_id;

  -- معالجة الطلبات المرتبطة
  v_orders := COALESCE(e.metadata->'order_ids', e.metadata->'settled_orders', e.metadata->'orders', '[]'::jsonb);

  -- إضافة معرفات الطلبات إلى الفاتورة
  UPDATE public.settlement_invoices
  SET order_ids = v_orders,
      settled_orders = v_orders,
      updated_at = now()
  WHERE id = v_invoice_id;

  -- تحديث المصروف ليشير إلى الفاتورة
  UPDATE public.expenses
  SET metadata = COALESCE(e.metadata,'{}'::jsonb) || jsonb_build_object(
    'settlement_invoice_id', v_invoice_id, 
    'migrated_to_settlement', true,
    'invoice_number', v_invoice_number
  ),
  updated_at = now()
  WHERE id = e.id;

  RETURN jsonb_build_object(
    'success', true, 
    'invoice_id', v_invoice_id, 
    'invoice_number', v_invoice_number,
    'employee_name', v_employee_name,
    'total_amount', v_total
  );
END $$;