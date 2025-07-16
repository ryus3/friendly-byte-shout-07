-- إصلاح مشاكل الأمان في functions بإضافة search_path = ''
CREATE OR REPLACE FUNCTION public.generate_telegram_code(user_id_input uuid, username_input text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  short_username TEXT;
  short_id TEXT;
  employee_code TEXT;
BEGIN
  -- أخذ أول 3 أحرف من اسم المستخدم وتحويلها للأحرف الكبيرة
  short_username := UPPER(LEFT(username_input, 3));
  
  -- أخذ آخر 4 أرقام من user_id
  short_id := RIGHT(REPLACE(user_id_input::TEXT, '-', ''), 4);
  
  -- دمج الكود
  employee_code := short_username || short_id;
  
  -- إدخال الكود في الجدول
  INSERT INTO public.telegram_employee_codes (user_id, employee_code)
  VALUES (user_id_input, employee_code)
  ON CONFLICT (user_id) DO UPDATE SET 
    employee_code = EXCLUDED.employee_code,
    updated_at = now();
  
  RETURN employee_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_customer_name text, p_customer_phone text DEFAULT NULL::text, p_customer_address text DEFAULT NULL::text, p_total_amount numeric DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb, p_telegram_chat_id bigint DEFAULT NULL::bigint, p_employee_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  order_id UUID;
BEGIN
  -- إدخال الطلب الجديد
  INSERT INTO public.ai_orders (
    order_data,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    items,
    source,
    telegram_chat_id,
    created_by
  ) VALUES (
    p_order_data,
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    p_total_amount,
    p_items,
    'telegram',
    p_telegram_chat_id,
    p_employee_code
  ) RETURNING id INTO order_id;

  -- إضافة إشعار للمراجعة
  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data,
    user_id
  ) VALUES (
    'طلب ذكي جديد',
    'تم استلام طلب جديد من التليغرام يحتاج للمراجعة',
    'ai_order',
    'high',
    jsonb_build_object('order_id', order_id, 'source', 'telegram'),
    NULL -- إشعار عام لجميع المشرفين
  );

  RETURN order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_telegram_user(p_employee_code text, p_telegram_chat_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- تحديث رمز الموظف بمعرف المحادثة
  UPDATE public.telegram_employee_codes 
  SET 
    telegram_chat_id = p_telegram_chat_id,
    linked_at = now(),
    updated_at = now()
  WHERE employee_code = p_employee_code AND is_active = true;
  
  -- إرجاع true إذا تم العثور على الموظف وتحديثه
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_telegram_chat_id bigint)
 RETURNS TABLE(user_id uuid, employee_code text, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    tec.employee_code,
    p.full_name,
    p.role
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_telegram_chat_id 
    AND tec.is_active = true
    AND p.is_active = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  next_number INTEGER;
  result_order_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number ~ '^ORD[0-9]+$';
  
  result_order_number := 'ORD' || LPAD(next_number::TEXT, 6, '0');
  RETURN result_order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_reserved_stock(p_product_id uuid, p_quantity_change integer, p_sku text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  current_quantity INTEGER;
  current_reserved INTEGER;
  new_reserved INTEGER;
  variant_uuid UUID;
BEGIN
  -- العثور على المخزون المناسب
  IF p_sku IS NOT NULL THEN
    -- محاولة تحويل p_sku إلى UUID إذا كان نص، أو استخدامه مباشرة إذا كان UUID
    BEGIN
      variant_uuid := p_sku::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      -- إذا فشل التحويل، البحث عن variant عبر barcode/sku
      SELECT id INTO variant_uuid 
      FROM public.product_variants 
      WHERE product_id = p_product_id AND (barcode = p_sku OR sku = p_sku);
      
      IF variant_uuid IS NULL THEN
        RAISE EXCEPTION 'المتغير غير موجود: %', p_sku;
      END IF;
    END;
    
    -- البحث باستخدام variant_id
    SELECT quantity, reserved_quantity INTO current_quantity, current_reserved
    FROM public.inventory
    WHERE product_id = p_product_id AND variant_id = variant_uuid;
  ELSE
    -- البحث باستخدام product_id فقط
    SELECT quantity, reserved_quantity INTO current_quantity, current_reserved
    FROM public.inventory
    WHERE product_id = p_product_id AND variant_id IS NULL;
  END IF;

  -- التحقق من وجود المخزون
  IF current_quantity IS NULL THEN
    RAISE EXCEPTION 'المنتج غير موجود في المخزون';
  END IF;

  -- حساب الكمية المحجوزة الجديدة
  new_reserved := current_reserved + p_quantity_change;

  -- التحقق من عدم تجاوز الكمية المتاحة
  IF new_reserved > current_quantity THEN
    RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون. المتاح: %, المطلوب: %', current_quantity - current_reserved, p_quantity_change;
  END IF;

  -- التحقق من عدم النزول تحت الصفر
  IF new_reserved < 0 THEN
    new_reserved := 0;
  END IF;

  -- تحديث الكمية المحجوزة
  IF p_sku IS NOT NULL THEN
    UPDATE public.inventory 
    SET reserved_quantity = new_reserved,
        updated_at = now()
    WHERE product_id = p_product_id AND variant_id = variant_uuid;
  ELSE
    UPDATE public.inventory 
    SET reserved_quantity = new_reserved,
        updated_at = now()
    WHERE product_id = p_product_id AND variant_id IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_stock_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  UPDATE public.inventory 
  SET 
    quantity = quantity - p_quantity,
    reserved_quantity = reserved_quantity - p_quantity,
    updated_at = now()
  WHERE product_id = p_product_id AND variant_id = p_variant_id;
  
  -- التحقق من أن التحديث تم بنجاح
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على المنتج في المخزون';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_stock_item(p_product_id uuid, p_variant_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  UPDATE public.inventory 
  SET 
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    updated_at = now()
  WHERE product_id = p_product_id AND variant_id = p_variant_id;
  
  -- التحقق من أن التحديث تم بنجاح
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على المنتج في المخزون';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_stock(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  available_stock INTEGER;
BEGIN
  SELECT GREATEST(0, quantity - reserved_quantity) INTO available_stock
  FROM public.inventory
  WHERE product_id = p_product_id AND 
        (p_variant_id IS NULL OR variant_id = p_variant_id);
  
  RETURN COALESCE(available_stock, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_employee_profit(p_employee_id uuid, p_product_id uuid, p_quantity integer, p_selling_price numeric, p_cost_price numeric, p_category_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  custom_profit NUMERIC := 0;
  default_profit NUMERIC := 0;
  profit_rule RECORD;
BEGIN
  -- البحث عن قاعدة مخصصة للمنتج
  SELECT * INTO profit_rule 
  FROM public.employee_profit_rules 
  WHERE employee_id = p_employee_id 
    AND rule_type = 'product' 
    AND target_id = p_product_id 
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- استخدام القاعدة المخصصة للمنتج
    IF profit_rule.profit_amount > 0 THEN
      RETURN profit_rule.profit_amount * p_quantity;
    ELSIF profit_rule.profit_percentage > 0 THEN
      RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
    END IF;
  END IF;
  
  -- البحث عن قاعدة مخصصة للفئة
  IF p_category_id IS NOT NULL THEN
    SELECT * INTO profit_rule 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'category' 
      AND target_id = p_category_id 
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      IF profit_rule.profit_amount > 0 THEN
        RETURN profit_rule.profit_amount * p_quantity;
      ELSIF profit_rule.profit_percentage > 0 THEN
        RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
      END IF;
    END IF;
  END IF;
  
  -- البحث عن قاعدة مخصصة للقسم
  IF p_department_id IS NOT NULL THEN
    SELECT * INTO profit_rule 
    FROM public.employee_profit_rules 
    WHERE employee_id = p_employee_id 
      AND rule_type = 'department' 
      AND target_id = p_department_id 
      AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      IF profit_rule.profit_amount > 0 THEN
        RETURN profit_rule.profit_amount * p_quantity;
      ELSIF profit_rule.profit_percentage > 0 THEN
        RETURN (p_selling_price * profit_rule.profit_percentage / 100) * p_quantity;
      END IF;
    END IF;
  END IF;
  
  -- استخدام الحساب الافتراضي
  default_profit := (p_selling_price - p_cost_price) * p_quantity;
  RETURN GREATEST(default_profit, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_purchase_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  next_number INTEGER;
  purchase_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.purchases
  WHERE purchase_number ~ '^PUR[0-9]+$';
  
  purchase_number := 'PUR' || LPAD(next_number::TEXT, 6, '0');
  RETURN purchase_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_order_profit(order_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  order_record RECORD;
  total_cost DECIMAL(10,2) := 0;
  total_revenue DECIMAL(10,2) := 0;
  profit_amount DECIMAL(10,2) := 0;
  employee_percentage DECIMAL(5,2) := 0;
  employee_profit DECIMAL(10,2) := 0;
BEGIN
  -- Get order details
  SELECT o.*, p.role 
  INTO order_record
  FROM public.orders o
  LEFT JOIN public.profiles p ON o.created_by = p.user_id
  WHERE o.id = order_id_input;
  
  IF order_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate total cost and revenue
  SELECT 
    COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, pr.cost_price)), 0),
    COALESCE(SUM(oi.total_price), 0)
  INTO total_cost, total_revenue
  FROM public.order_items oi
  LEFT JOIN public.products pr ON oi.product_id = pr.id
  LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
  WHERE oi.order_id = order_id_input;
  
  profit_amount := total_revenue - total_cost;
  
  -- Set employee percentage based on role
  employee_percentage := CASE 
    WHEN order_record.role = 'admin' THEN 100.0
    WHEN order_record.role = 'manager' THEN 15.0
    ELSE 10.0
  END;
  
  employee_profit := profit_amount * (employee_percentage / 100.0);
  
  -- Insert or update profit record
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
    profit_amount,
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
$function$;

CREATE OR REPLACE FUNCTION public.get_user_by_username(username_input text)
 RETURNS TABLE(email text, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY 
  SELECT p.email, p.user_id
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(username_input)
  AND p.is_active = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_with_username(username_input text, password_input text)
 RETURNS TABLE(success boolean, user_email text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_email_found TEXT;
BEGIN
  -- البحث عن البريد الإلكتروني المرتبط باسم المستخدم
  SELECT email INTO user_email_found 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_input) 
  AND is_active = true 
  AND status = 'active';
  
  -- إذا لم يوجد المستخدم
  IF user_email_found IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'اسم المستخدم غير صحيح أو غير موجود'::TEXT;
    RETURN;
  END IF;
  
  -- إرجاع النتيجة الإيجابية مع البريد الإلكتروني
  RETURN QUERY SELECT true, user_email_found, ''::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.username_exists(p_username text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(p_username)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;