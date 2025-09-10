-- إصلاح دالة إنشاء سجل الربح التلقائي
CREATE OR REPLACE FUNCTION public.auto_create_profit_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  order_total_revenue NUMERIC := 0;
  order_delivery_fee NUMERIC := 0;
  order_sales_amount NUMERIC := 0;
  order_total_cost NUMERIC := 0;
  order_profit_amount NUMERIC := 0;
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

  -- حساب رسوم التوصيل
  order_delivery_fee := COALESCE(NEW.delivery_fee, 0);
  
  -- حساب مبلغ المبيعات (بدون رسوم التوصيل)
  order_sales_amount := COALESCE(NEW.final_amount, NEW.total_amount, 0) - order_delivery_fee;
  
  -- إجمالي الإيراد = مبلغ المبيعات + رسوم التوصيل
  order_total_revenue := order_sales_amount + order_delivery_fee;

  -- حساب التكلفة الإجمالية من عناصر الطلب
  SELECT COALESCE(SUM(
    COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
  ), 0) INTO order_total_cost
  FROM order_items oi
  LEFT JOIN product_variants pv ON oi.variant_id = pv.id
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = NEW.id;

  -- حساب الربح = المبيعات - التكلفة (بدون رسوم التوصيل)
  order_profit_amount := order_sales_amount - order_total_cost;

  -- ربح الموظف = 0 (سيتم حسابه من قواعد الأرباح لاحقاً)
  employee_profit_amount := 0;

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
    0, -- لا نسبة افتراضية للموظف
    employee_profit_amount,
    CASE 
      WHEN NEW.receipt_received = true THEN 'invoice_received'
      ELSE 'pending'
    END,
    now(),
    now()
  );

  RAISE NOTICE 'تم إنشاء سجل ربح تلقائي للطلب % - الربح: %', COALESCE(NEW.order_number, NEW.id::text), order_profit_amount;

  RETURN NEW;
END;
$function$;

-- تصحيح البيانات الموجودة
UPDATE public.profits 
SET 
  profit_amount = CASE 
    WHEN order_id IN (
      SELECT o.id FROM orders o WHERE o.order_number = 'ORD000013'
    ) THEN 4000 -- الربح الصحيح بدون رسوم التوصيل
    ELSE profit_amount
  END,
  employee_percentage = 0,
  employee_profit = 0,
  updated_at = now()
WHERE order_id IN (
  SELECT o.id FROM orders o WHERE o.order_number IN ('ORD000013', 'ORD000010')
);

-- التحقق من النتائج
UPDATE public.profits 
SET 
  total_revenue = (
    SELECT COALESCE(o.final_amount, o.total_amount, 0)
    FROM orders o 
    WHERE o.id = profits.order_id
  ),
  total_cost = (
    SELECT COALESCE(SUM(
      COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
    ), 0)
    FROM order_items oi
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = profits.order_id
  ),
  profit_amount = (
    SELECT 
      (COALESCE(o.final_amount, o.total_amount, 0) - COALESCE(o.delivery_fee, 0)) - 
      COALESCE(SUM(
        COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity
      ), 0)
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = profits.order_id
    GROUP BY o.id, o.final_amount, o.total_amount, o.delivery_fee
  ),
  updated_at = now()
WHERE order_id IN (
  SELECT o.id FROM orders o WHERE o.order_number IN ('ORD000013', 'ORD000010')
);