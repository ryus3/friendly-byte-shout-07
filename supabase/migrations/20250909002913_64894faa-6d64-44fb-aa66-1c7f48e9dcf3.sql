-- دالة هجرة مصروفات مستحقات الموظفين إلى فواتير التسوية
CREATE OR REPLACE FUNCTION public.migrate_employee_dues_expenses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  expense_record RECORD;
  employee_record RECORD;
  settlement_invoice_id UUID;
  order_record RECORD;
  profit_record RECORD;
  migrated_count INTEGER := 0;
  settled_orders_data JSONB := '[]'::jsonb;
BEGIN
  -- البحث عن المصروفات بفئة "مستحقات الموظفين" التي لم يتم ترحيلها بعد
  FOR expense_record IN 
    SELECT * FROM expenses 
    WHERE category = 'مستحقات الموظفين' 
      AND status = 'approved'
      AND (metadata->>'migrated_to_settlement')::boolean IS NOT TRUE
  LOOP
    -- الحصول على معلومات الموظف
    SELECT * INTO employee_record 
    FROM profiles 
    WHERE user_id = expense_record.created_by;
    
    IF employee_record.user_id IS NULL THEN
      CONTINUE; -- تخطي إذا لم يوجد الموظف
    END IF;
    
    -- إنشاء معرف فريد للفاتورة
    settlement_invoice_id := gen_random_uuid();
    
    -- البحث عن الطلبات والأرباح المرتبطة بالموظف في نفس الفترة
    settled_orders_data := '[]'::jsonb;
    
    -- البحث عن أرباح الموظف المستقرة في نفس الفترة تقريباً
    FOR profit_record IN
      SELECT p.*, o.order_number, o.final_amount, o.customer_name, o.customer_phone, o.created_at as order_date
      FROM profits p
      JOIN orders o ON p.order_id = o.id
      WHERE p.employee_id = employee_record.user_id
        AND p.status = 'settled'
        AND p.settled_at BETWEEN (expense_record.created_at - INTERVAL '30 days') AND (expense_record.created_at + INTERVAL '30 days')
      ORDER BY p.settled_at DESC
      LIMIT 10
    LOOP
      -- إضافة بيانات الطلب إلى settled_orders
      settled_orders_data := settled_orders_data || jsonb_build_object(
        'id', profit_record.order_id,
        'order_number', profit_record.order_number,
        'final_amount', profit_record.final_amount,
        'customer_name', profit_record.customer_name,
        'customer_phone', profit_record.customer_phone,
        'order_date', profit_record.order_date,
        'employee_profit', profit_record.employee_profit,
        'profit_amount', profit_record.profit_amount
      );
    END LOOP;
    
    -- إنشاء فاتورة التسوية
    INSERT INTO settlement_invoices (
      id,
      employee_id,
      employee_name,
      employee_phone,
      total_amount,
      settled_orders,
      payment_method,
      notes,
      created_by,
      settlement_date,
      created_at,
      updated_at
    ) VALUES (
      settlement_invoice_id,
      employee_record.user_id,
      employee_record.full_name,
      employee_record.phone,
      expense_record.amount,
      settled_orders_data,
      COALESCE(expense_record.metadata->>'payment_method', 'cash'),
      COALESCE(expense_record.description, 'تسوية مستحقات موظف - ' || employee_record.full_name),
      expense_record.created_by,
      expense_record.created_at::date,
      expense_record.created_at,
      expense_record.created_at
    );
    
    -- تحديث المصروف لوضع علامة الهجرة
    UPDATE expenses 
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'migrated_to_settlement', true,
      'settlement_invoice_id', settlement_invoice_id,
      'migration_date', now()
    ),
    updated_at = now()
    WHERE id = expense_record.id;
    
    migrated_count := migrated_count + 1;
    
    RAISE NOTICE 'تم ترحيل فاتورة للموظف %: % دينار', employee_record.full_name, expense_record.amount;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'message', 'تم ترحيل ' || migrated_count || ' فاتورة مستحقات إلى فواتير التسوية'
  );
END;
$function$;