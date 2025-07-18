-- إضافة أعمدة الأرباح للمنتجات والمتغيرات
ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(10,2) DEFAULT 0;

-- حذف الدوال القديمة للنسب المئوية
DROP FUNCTION IF EXISTS calculate_employee_profit(uuid, uuid, integer, numeric, numeric, uuid, uuid);
DROP FUNCTION IF EXISTS calculate_employee_detailed_profit(uuid, uuid);

-- إنشاء دالة جديدة لحساب الأرباح بالمبالغ الثابتة
CREATE OR REPLACE FUNCTION calculate_order_profit_fixed_amounts(order_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  -- الحصول على تفاصيل الطلب
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_id_input;
  
  IF order_record IS NULL THEN
    RETURN;
  END IF;
  
  -- حساب التكلفة والإيرادات والأرباح لكل عنصر
  FOR item_record IN 
    SELECT 
      oi.*,
      COALESCE(pv.cost_price, p.cost_price) as item_cost_price,
      COALESCE(pv.profit_amount, p.profit_amount) as item_profit_amount
    FROM public.order_items oi
    LEFT JOIN public.products p ON oi.product_id = p.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = order_id_input
  LOOP
    total_cost := total_cost + (item_record.item_cost_price * item_record.quantity);
    total_revenue := total_revenue + item_record.total_price;
    
    -- حساب ربح الموظف للعنصر الحالي
    employee_profit := employee_profit + calculate_employee_item_profit(
      order_record.created_by,
      item_record.product_id,
      item_record.variant_id,
      item_record.quantity,
      item_record.item_profit_amount
    );
  END LOOP;
  
  total_profit := total_revenue - total_cost;
  
  -- تحديد نسبة الموظف (0% للمدير، نسبة للموظفين)
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
  
  -- إدراج أو تحديث سجل الأرباح
  INSERT INTO public.profits (
    order_id,
    employee_id,
    total_revenue,
    total_cost,
    profit_amount,
    employee_percentage,
    employee_profit,
    status
  ) VALUES (
    order_id_input,
    order_record.created_by,
    total_revenue,
    total_cost,
    total_profit,
    employee_percentage,
    employee_profit,
    'pending'
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

-- دالة مساعدة لحساب ربح الموظف لكل عنصر
CREATE OR REPLACE FUNCTION calculate_employee_item_profit(
  p_employee_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_base_profit_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  final_profit NUMERIC := 0;
  rule_record RECORD;
  product_category_id uuid;
  product_department_id uuid;
  product_type_id uuid;
BEGIN
  -- تحقق من أن المستخدم ليس مدير (المديرون لا يحصلون على أرباح)
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = p_employee_id 
    AND r.name IN ('super_admin', 'admin')
    AND ur.is_active = true
  ) THEN
    RETURN 0;
  END IF;
  
  -- البحث عن قاعدة مخصصة للمنتج المحدد (أولوية عالية)
  SELECT * INTO rule_record 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'product' 
    AND target_id = p_product_id::text
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RETURN rule_record.profit_amount * p_quantity;
  END IF;
  
  -- البحث عن قاعدة للمتغير المحدد (أولوية عالية)
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'variant' 
      AND target_id = p_variant_id::text
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      RETURN rule_record.profit_amount * p_quantity;
    END IF;
  END IF;
  
  -- الحصول على معرفات الفئة والقسم ونوع المنتج
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
  
  -- البحث عن قاعدة للفئة
  IF product_category_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'category' 
      AND target_id = product_category_id::text
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      RETURN rule_record.profit_amount * p_quantity;
    END IF;
  END IF;
  
  -- البحث عن قاعدة للقسم
  IF product_department_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'department' 
      AND target_id = product_department_id::text
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      RETURN rule_record.profit_amount * p_quantity;
    END IF;
  END IF;
  
  -- البحث عن قاعدة لنوع المنتج
  IF product_type_id IS NOT NULL THEN
    SELECT * INTO rule_record 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'product_type' 
      AND target_id = product_type_id::text
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      RETURN rule_record.profit_amount * p_quantity;
    END IF;
  END IF;
  
  -- البحث عن قاعدة افتراضية للموظف
  SELECT * INTO rule_record 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'default' 
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RETURN rule_record.profit_amount * p_quantity;
  END IF;
  
  -- استخدام ربح المنتج الافتراضي
  RETURN COALESCE(p_base_profit_amount, 0) * p_quantity;
END;
$$;

-- إنشاء trigger لحساب الأرباح عند استلام الفاتورة
CREATE OR REPLACE FUNCTION trigger_calculate_profit_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received 
     AND NEW.receipt_received = true THEN
    
    PERFORM calculate_order_profit_fixed_amounts(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS calculate_profit_on_receipt_trigger ON orders;
CREATE TRIGGER calculate_profit_on_receipt_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_profit_on_receipt();

-- حذف السجلات القديمة من جدول الأرباح التي تستخدم النسب المئوية
DELETE FROM profits WHERE employee_percentage > 0 AND employee_percentage < 100;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_profits_order_employee ON profits(order_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_profit_rules_lookup ON employee_profit_rules(employee_id, rule_type, target_id) WHERE is_active = true;