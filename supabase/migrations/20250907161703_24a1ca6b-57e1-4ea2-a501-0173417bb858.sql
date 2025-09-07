-- إنشاء الدالة المساعدة في public
CREATE OR REPLACE FUNCTION public.calculate_employee_item_profit(
  p_employee_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_base_profit_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  final_profit NUMERIC := 0;
  rule_record RECORD;
  product_category_id uuid;
  product_department_id uuid;
  product_type_id uuid;
BEGIN
  -- المديرون لا يحصلون على أرباح
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = p_employee_id 
      AND r.name IN ('super_admin', 'admin')
      AND ur.is_active = true
  ) THEN
    RETURN 0;
  END IF;

  -- قاعدة المنتج
  SELECT * INTO rule_record 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'product' 
    AND target_id = p_product_id::text
    AND is_active = true
  LIMIT 1;
  IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;

  -- قاعدة المتغير
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'variant' 
      AND target_id = p_variant_id::text
      AND is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;
  END IF;

  -- معرفات الفئة/القسم/نوع المنتج
  SELECT 
    pc.category_id,
    pd.department_id,
    ppt.product_type_id
  INTO 
    product_category_id,
    product_department_id,
    product_type_id
  FROM public.products p
  LEFT JOIN public.product_categories pc ON p.id = pc.product_id
  LEFT JOIN public.product_departments pd ON p.id = pd.product_id
  LEFT JOIN public.product_product_types ppt ON p.id = ppt.product_id
  WHERE p.id = p_product_id
  LIMIT 1;

  -- قاعدة الفئة
  IF product_category_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'category' 
      AND target_id = product_category_id::text
      AND is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;
  END IF;

  -- قاعدة القسم
  IF product_department_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'department' 
      AND target_id = product_department_id::text
      AND is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;
  END IF;

  -- قاعدة نوع المنتج
  IF product_type_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'product_type' 
      AND target_id = product_type_id::text
      AND is_active = true
    LIMIT 1;
    IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;
  END IF;

  -- القاعدة الافتراضية للموظف
  SELECT * INTO rule_record 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'default' 
    AND is_active = true
  LIMIT 1;
  IF FOUND THEN RETURN rule_record.profit_amount * p_quantity; END IF;

  -- الربح الأساسي من المنتج/المتغير
  RETURN COALESCE(p_base_profit_amount, 0) * p_quantity;
END;
$$;

-- إنشاء/تصحيح الدالة الرئيسية في public
CREATE OR REPLACE FUNCTION public.calculate_order_profit_fixed_amounts(order_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  item_record RECORD;
  total_cost DECIMAL(10,2) := 0;
  total_revenue DECIMAL(10,2) := 0;
  total_profit DECIMAL(10,2) := 0;
  employee_profit DECIMAL(10,2) := 0;
  employee_percentage DECIMAL(5,2) := 0;
BEGIN
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_id_input;
  IF order_record IS NULL THEN RETURN; END IF;

  FOR item_record IN 
    SELECT 
      oi.*,
      COALESCE(pv.cost_price, p.cost_price) as item_cost_price,
      COALESCE(pv.profit_amount, p.profit_amount, 0) as item_profit_amount
    FROM public.order_items oi
    LEFT JOIN public.products p ON oi.product_id = p.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = order_id_input
  LOOP
    total_cost := total_cost + (item_record.item_cost_price * item_record.quantity);
    total_revenue := total_revenue + item_record.total_price;

    employee_profit := employee_profit + public.calculate_employee_item_profit(
      order_record.created_by,
      item_record.product_id,
      item_record.variant_id,
      item_record.quantity,
      item_record.item_profit_amount
    );
  END LOOP;

  total_profit := total_revenue - total_cost;

  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = order_record.created_by 
          AND r.name IN ('super_admin', 'admin')
          AND ur.is_active = true
      ) THEN 0.0
      ELSE 100.0
    END
  INTO employee_percentage;

  INSERT INTO public.profits (
    order_id, employee_id, total_revenue, total_cost, profit_amount,
    employee_percentage, employee_profit, status
  ) VALUES (
    order_id_input, order_record.created_by, total_revenue, total_cost,
    total_profit, employee_percentage, employee_profit, 'pending'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    profit_amount = EXCLUDED.profit_amount,
    employee_percentage = EXCLUDED.employee_percentage,
    employee_profit = EXCLUDED.employee_profit,
    updated_at = now();
END;
$$;

-- إعادة حساب الطلب المطلوب
SELECT public.calculate_order_profit_fixed_amounts('73e17a6f-85c7-4a1c-a793-d8f9303de037'::uuid);