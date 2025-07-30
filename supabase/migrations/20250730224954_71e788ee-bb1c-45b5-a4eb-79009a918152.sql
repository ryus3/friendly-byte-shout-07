-- إنشاء جدول فواتير التسوية الحقيقية
CREATE TABLE public.settlement_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  settlement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  order_ids UUID[] DEFAULT '{}',
  profit_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed'
);

-- فهرسة للبحث السريع
CREATE INDEX idx_settlement_invoices_employee_id ON public.settlement_invoices(employee_id);
CREATE INDEX idx_settlement_invoices_settlement_date ON public.settlement_invoices(settlement_date);
CREATE INDEX idx_settlement_invoices_invoice_number ON public.settlement_invoices(invoice_number);

-- تمكين RLS
ALTER TABLE public.settlement_invoices ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "المستخدمون المصرح لهم يديرون فواتير التسوية"
ON public.settlement_invoices
FOR ALL
USING (auth.uid() IS NOT NULL);

-- دالة دفع المستحقات المحدثة مع إنشاء فاتورة حقيقية
CREATE OR REPLACE FUNCTION public.pay_employee_dues_with_invoice(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT '',
  p_paid_by UUID DEFAULT NULL,
  p_order_ids UUID[] DEFAULT '{}',
  p_profit_ids UUID[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cash_id UUID;
  employee_name TEXT;
  invoice_number TEXT;
  settlement_invoice_id UUID;
  result_data jsonb;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- الحصول على اسم الموظف
  SELECT full_name INTO employee_name FROM profiles WHERE user_id = p_employee_id;
  
  IF main_cash_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'القاصة الرئيسية غير موجودة');
  END IF;
  
  IF employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الموظف غير موجود');
  END IF;
  
  -- إنشاء رقم فاتورة فريد
  invoice_number := 'RY-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));
  
  -- التأكد من عدم تكرار رقم الفاتورة
  WHILE EXISTS (SELECT 1 FROM settlement_invoices WHERE invoice_number = invoice_number) LOOP
    invoice_number := 'RY-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));
  END LOOP;
  
  -- إنشاء فاتورة التسوية الحقيقية
  INSERT INTO settlement_invoices (
    invoice_number,
    employee_id,
    employee_name,
    total_amount,
    settlement_date,
    description,
    order_ids,
    profit_ids,
    notes,
    created_by
  ) VALUES (
    invoice_number,
    p_employee_id,
    employee_name,
    p_amount,
    now(), -- تاريخ التسوية الحقيقي
    COALESCE(p_description, 'دفع مستحقات الموظف ' || employee_name),
    p_order_ids,
    p_profit_ids,
    'فاتورة تسوية حقيقية - ' || COALESCE(p_description, ''),
    COALESCE(p_paid_by, auth.uid())
  ) RETURNING id INTO settlement_invoice_id;
  
  -- تسجيل الحركة النقدية لدفع المستحقات
  PERFORM public.update_cash_source_balance(
    main_cash_id,
    p_amount,
    'out',
    'employee_dues',
    settlement_invoice_id, -- ربط الحركة بفاتورة التسوية
    'دفع مستحقات - فاتورة رقم: ' || invoice_number,
    COALESCE(p_paid_by, auth.uid())
  );
  
  -- إضافة مصروف من نوع نظام مع رقم الفاتورة الحقيقي
  INSERT INTO expenses (
    category,
    expense_type,
    description,
    amount,
    status,
    created_by,
    approved_by,
    approved_at,
    receipt_number, -- رقم الفاتورة الحقيقي
    metadata
  ) VALUES (
    'مستحقات الموظفين',
    'system',
    'دفع مستحقات الموظف ' || employee_name || ' - فاتورة: ' || invoice_number,
    p_amount,
    'approved',
    COALESCE(p_paid_by, auth.uid()),
    COALESCE(p_paid_by, auth.uid()),
    now(),
    invoice_number, -- رقم الفاتورة الحقيقي كرقم الإيصال
    jsonb_build_object(
      'employee_id', p_employee_id,
      'employee_name', employee_name,
      'settlement_invoice_id', settlement_invoice_id,
      'settlement_invoice_number', invoice_number,
      'payment_date', now(),
      'payment_type', 'employee_dues'
    )
  );
  
  -- تحديث حالة الأرباح إلى مدفوعة
  UPDATE profits 
  SET status = 'settled',
      settled_at = now(),
      settled_by = COALESCE(p_paid_by, auth.uid())
  WHERE employee_id = p_employee_id 
  AND status = 'pending'
  AND (array_length(p_profit_ids, 1) IS NULL OR id = ANY(p_profit_ids));
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم دفع مستحقات الموظف ' || employee_name || ' بنجاح',
    'invoice_number', invoice_number,
    'settlement_invoice_id', settlement_invoice_id,
    'amount', p_amount,
    'employee_name', employee_name,
    'settlement_date', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;