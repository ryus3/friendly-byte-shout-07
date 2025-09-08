DO $$
DECLARE
  v_order uuid := '73e17a6f-85c7-4a1c-a793-d8f9303de037'::uuid; -- ORD000005
  v_cash_source uuid := 'f70cfbb5-343a-4a2d-9e36-489beaf29392'::uuid; -- القاصة الرئيسية
  v_created_by uuid := 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid; -- صاحب الطلب
  v_admin uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid; -- المدير
  v_net_revenue numeric := 21000; -- 26000 - 5000
  v_emp_due numeric := 7000; -- من profits
BEGIN
  -- 1) تصحيح الإيراد في جدول الأرباح
  UPDATE public.profits 
  SET total_revenue = v_net_revenue,
      updated_at = now()
  WHERE order_id = v_order;

  -- 2) تنظيف الحركات النقدية ذات الصلة ثم إدراج الحركات الصحيحة
  DELETE FROM public.cash_movements 
  WHERE reference_id = v_order 
    AND movement_type IN ('revenue','delivery_expense','employee_dues');

  -- حركة الإيراد الصافية
  INSERT INTO public.cash_movements (
    cash_source_id, amount, reference_id, balance_before, balance_after, created_by,
    movement_type, reference_type, description
  ) VALUES (
    v_cash_source, v_net_revenue, v_order, 0, 0, v_created_by,
    'revenue', 'order', 'إيراد طلب ORD000005: المستلم 21,000 (الإجمالي 26,000 - التوصيل 5,000)'
  );

  -- 3) تسوية مصروف مستحقات الموظف: حذف أي سجل سابق لنفس الطلب ثم إنشاء واحد صحيح
  DELETE FROM public.expenses 
  WHERE category = 'مستحقات الموظفين'
    AND metadata ? 'order_id'
    AND (metadata->>'order_id')::uuid = v_order;

  INSERT INTO public.expenses (
    amount, created_by, approved_by, approved_at, expense_type, category, description, status, metadata
  ) VALUES (
    v_emp_due, v_created_by, v_admin, now(), 'system', 'مستحقات الموظفين',
    'مستحقات الموظف - طلب ORD000005', 'approved',
    jsonb_build_object('order_id', v_order, 'order_number', 'ORD000005')
  );

  -- حركة نقدية لصرف مستحقات الموظف
  INSERT INTO public.cash_movements (
    cash_source_id, amount, reference_id, balance_before, balance_after, created_by,
    movement_type, reference_type, description
  ) VALUES (
    v_cash_source, -v_emp_due, v_order, 0, 0, v_admin,
    'employee_dues', 'order', 'دفع مستحقات الموظف - طلب ORD000005'
  );
END $$;