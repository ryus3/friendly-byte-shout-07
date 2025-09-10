-- التحقق من الطلبات المُسلّمة بدون سجلات أرباح وإنشاؤها
INSERT INTO public.profits (
  order_id,
  employee_id,
  total_revenue,
  total_cost,
  profit_amount,
  employee_percentage,
  employee_profit,
  status,
  created_at,
  updated_at
)
SELECT 
  o.id as order_id,
  o.created_by as employee_id,
  -- إجمالي الإيراد من الطلب
  COALESCE(o.final_amount, o.total_amount, 0) as total_revenue,
  -- حساب التكلفة الإجمالية من عناصر الطلب
  COALESCE(
    (SELECT SUM(
      COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
    ) 
    FROM order_items oi
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = o.id), 
    0
  ) as total_cost,
  -- حساب الربح الإجمالي
  COALESCE(o.final_amount, o.total_amount, 0) - 
  COALESCE(
    (SELECT SUM(
      COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
    ) 
    FROM order_items oi
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = o.id), 
    0
  ) as profit_amount,
  -- نسبة الموظف (0% للمدير، تطبيق القواعد للموظفين)
  CASE 
    WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN 0
    ELSE 20  -- نسبة افتراضية، يمكن تعديلها بناءً على قواعد المؤسسة
  END as employee_percentage,
  -- حساب ربح الموظف
  CASE 
    WHEN o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN 0
    ELSE (
      COALESCE(o.final_amount, o.total_amount, 0) - 
      COALESCE(
        (SELECT SUM(
          COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
        ) 
        FROM order_items oi
        LEFT JOIN product_variants pv ON oi.variant_id = pv.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = o.id), 
        0
      )
    ) * 0.20  -- 20% للموظف
  END as employee_profit,
  -- تحديد حالة الربح بناءً على استلام الفاتورة
  CASE 
    WHEN o.receipt_received = true THEN 'invoice_received'
    ELSE 'pending'
  END as status,
  now() as created_at,
  now() as updated_at
FROM public.orders o
WHERE 
  -- طلبات مُسلّمة أو مكتملة
  o.status IN ('delivered', 'completed')
  -- ليس لها سجل ربح موجود
  AND NOT EXISTS (
    SELECT 1 FROM public.profits pr 
    WHERE pr.order_id = o.id
  )
  -- تحديد نطاق زمني معقول لتجنب معالجة طلبات قديمة جداً
  AND o.created_at >= '2024-01-01'::date;

-- إنشاء trigger تلقائي لإنشاء سجلات الأرباح للطلبات الجديدة
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  order_total_revenue NUMERIC := 0;
  order_total_cost NUMERIC := 0;
  order_profit_amount NUMERIC := 0;
  employee_percentage_rate NUMERIC := 0;
  employee_profit_amount NUMERIC := 0;
BEGIN
  -- فقط للطلبات المُسلّمة أو المكتملة
  IF NEW.status NOT IN ('delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  -- التحقق من عدم وجود سجل ربح مسبق
  IF EXISTS (SELECT 1 FROM public.profits WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- حساب إجمالي الإيراد
  order_total_revenue := COALESCE(NEW.final_amount, NEW.total_amount, 0);

  -- حساب التكلفة الإجمالية من عناصر الطلب
  SELECT COALESCE(SUM(
    COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
  ), 0) INTO order_total_cost
  FROM order_items oi
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = NEW.id;

  -- حساب الربح الإجمالي
  order_profit_amount := order_total_revenue - order_total_cost;

  -- تحديد نسبة الموظف (0% للمدير، نسبة للموظفين)
  IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
    employee_percentage_rate := 0;
  ELSE
    employee_percentage_rate := 20; -- نسبة افتراضية، يمكن تعديلها
  END IF;

  -- حساب ربح الموظف
  employee_profit_amount := order_profit_amount * (employee_percentage_rate / 100.0);

  -- إنشاء سجل الربح
  INSERT INTO public.profits (
    order_id,
    employee_id,
    total_revenue,
    total_cost,
    profit_amount,
    employee_percentage,
    employee_profit,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.created_by,
    order_total_revenue,
    order_total_cost,
    order_profit_amount,
    employee_percentage_rate,
    employee_profit_amount,
    CASE 
      WHEN NEW.receipt_received = true THEN 'invoice_received'
      ELSE 'pending'
    END,
    now(),
    now()
  );

  RAISE NOTICE 'تم إنشاء سجل ربح تلقائي للطلب %', COALESCE(NEW.order_number, NEW.id::text);

  RETURN NEW;
END;
$function$;

-- ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS trigger_auto_create_profit_record ON public.orders;
CREATE TRIGGER trigger_auto_create_profit_record
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_profit_record();

-- تحديث حالات الأرباح بناءً على استلام الفواتير
CREATE OR REPLACE FUNCTION public.sync_profit_status_with_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- عند تغيير حالة استلام الفاتورة
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
    UPDATE public.profits
    SET 
      status = CASE 
        WHEN NEW.receipt_received = true THEN 'invoice_received'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ربط الـ trigger بتحديث استلام الفواتير
DROP TRIGGER IF EXISTS trigger_sync_profit_status_with_receipt ON public.orders;
CREATE TRIGGER trigger_sync_profit_status_with_receipt
  AFTER UPDATE OF receipt_received ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profit_status_with_receipt();