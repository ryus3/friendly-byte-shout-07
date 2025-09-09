-- CRITICAL SECURITY FIXES - Phase 1: Remove hardcoded admin ID and secure data access

-- 1. Create improved admin detection function that doesn't rely on hardcoded IDs
CREATE OR REPLACE FUNCTION public.is_admin_or_deputy_secure()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'deputy')
      AND ur.is_active = true
  );
$$;

-- 2. Create function to check if user can view all orders (replacing hardcoded checks)
CREATE OR REPLACE FUNCTION public.can_view_all_orders()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (
        r.name IN ('super_admin', 'admin', 'deputy')
        OR p.name = 'view_all_orders'
      )
  );
$$;

-- 3. Create function to check if user can manage finances
CREATE OR REPLACE FUNCTION public.can_manage_finances()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND (
        r.name IN ('super_admin', 'admin')
        OR p.name IN ('manage_finances', 'manage_profits')
      )
  );
$$;

-- 4. Secure orders table - Remove PII exposure and add proper access controls
DROP POLICY IF EXISTS "المديرون والموظفون يرون الطلبات" ON public.orders;
DROP POLICY IF EXISTS "المديرون والموظفون يديرون الطلبات" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Users can manage orders" ON public.orders;

-- Create secure order viewing policy
CREATE POLICY "Secure order viewing policy" ON public.orders
FOR SELECT TO authenticated
USING (
  can_view_all_orders() OR created_by = auth.uid()
);

-- Create secure order management policy
CREATE POLICY "Secure order management policy" ON public.orders
FOR ALL TO authenticated
USING (
  can_view_all_orders() OR created_by = auth.uid()
)
WITH CHECK (
  can_view_all_orders() OR created_by = auth.uid()
);

-- 5. Secure customer data in orders - anonymize for non-authorized users
CREATE OR REPLACE VIEW public.orders_secure_view AS
SELECT 
  id,
  order_number,
  tracking_number,
  -- Anonymize customer data for non-admin users
  CASE 
    WHEN can_view_all_orders() THEN customer_name
    ELSE CONCAT(LEFT(customer_name, 1), '***')
  END as customer_name,
  CASE 
    WHEN can_view_all_orders() THEN customer_phone
    ELSE CONCAT('***', RIGHT(customer_phone, 4))
  END as customer_phone,
  CASE 
    WHEN can_view_all_orders() THEN customer_address
    ELSE '*** محجوب للخصوصية ***'
  END as customer_address,
  CASE 
    WHEN can_view_all_orders() THEN customer_city
    ELSE customer_city -- City can remain visible
  END as customer_city,
  customer_province,
  delivery_partner,
  delivery_status,
  delivery_partner_order_id,
  delivery_partner_invoice_id,
  status,
  receipt_received,
  receipt_received_at,
  receipt_received_by,
  isarchived,
  final_amount,
  discount_amount,
  shipping_cost,
  notes,
  created_by,
  created_at,
  updated_at,
  qr_id
FROM public.orders
WHERE can_view_all_orders() OR created_by = auth.uid();

-- 6. Secure products table - require authentication
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;

CREATE POLICY "Authenticated users can view products" ON public.products
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage products" ON public.products
FOR ALL TO authenticated
USING (can_view_all_orders())
WITH CHECK (can_view_all_orders());

-- 7. Secure categories table - require authentication
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

CREATE POLICY "Authenticated users can view categories" ON public.categories
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage categories" ON public.categories
FOR ALL TO authenticated
USING (can_view_all_orders())
WITH CHECK (can_view_all_orders());

-- 8. Secure variants table - require authentication  
DROP POLICY IF EXISTS "Anyone can view variants" ON public.variants;
DROP POLICY IF EXISTS "Authenticated users can manage variants" ON public.variants;

CREATE POLICY "Authenticated users can view variants" ON public.variants
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage variants" ON public.variants
FOR ALL TO authenticated
USING (can_view_all_orders())
WITH CHECK (can_view_all_orders());

-- 9. Update profits policies to use secure functions
DROP POLICY IF EXISTS "المديرون يديرون كل الأرباح" ON public.profits;
DROP POLICY IF EXISTS "الموظفون يرون أرباحهم والمديرون ي" ON public.profits;

CREATE POLICY "Secure profits viewing policy" ON public.profits
FOR SELECT TO authenticated
USING (
  employee_id = auth.uid() OR can_manage_finances()
);

CREATE POLICY "Secure profits management policy" ON public.profits
FOR ALL TO authenticated
USING (can_manage_finances())
WITH CHECK (can_manage_finances());

-- 10. Update profiles policies to remove hardcoded admin ID
DROP POLICY IF EXISTS "Safe admin access to profiles" ON public.profiles;

CREATE POLICY "Secure profile access policy" ON public.profiles
FOR ALL TO authenticated
USING (
  auth.uid() = user_id OR is_admin_or_deputy_secure()
)
WITH CHECK (
  auth.uid() = user_id OR is_admin_or_deputy_secure()
);