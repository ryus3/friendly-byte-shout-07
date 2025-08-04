-- إنشاء دالة لحساب إحصائيات العملاء لكل مستخدم منفصلاً
CREATE OR REPLACE FUNCTION public.get_user_customers_with_loyalty(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    phone text,
    email text,
    city text,
    province text,
    address text,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz,
    total_points integer,
    total_orders integer,
    total_spent numeric,
    current_tier_id uuid,
    tier_name text,
    tier_color text,
    tier_icon text,
    tier_discount_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.city,
        c.province,
        c.address,
        c.created_by,
        c.created_at,
        c.updated_at,
        COALESCE(cl.total_points, 0) as total_points,
        COALESCE(cl.total_orders, 0) as total_orders,
        COALESCE(cl.total_spent, 0) as total_spent,
        cl.current_tier_id,
        lt.name as tier_name,
        lt.color as tier_color,
        lt.icon as tier_icon,
        lt.discount_percentage as tier_discount_percentage
    FROM public.customers c
    LEFT JOIN public.customer_loyalty cl ON c.id = cl.customer_id
    LEFT JOIN public.loyalty_tiers lt ON cl.current_tier_id = lt.id
    WHERE c.created_by = p_user_id
    ORDER BY COALESCE(cl.total_points, 0) DESC, c.created_at DESC;
END;
$$;

-- إنشاء دالة لحساب إحصائيات المدن لكل مستخدم منفصلاً
CREATE OR REPLACE FUNCTION public.get_user_city_stats(p_user_id uuid)
RETURNS TABLE (
    city_name text,
    total_orders bigint,
    total_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM now());
    current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
    RETURN QUERY
    SELECT 
        o.customer_city as city_name,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(COALESCE(o.final_amount, o.total_amount)), 0) as total_amount
    FROM public.orders o
    WHERE o.created_by = p_user_id
    AND o.status = 'completed'
    AND o.receipt_received = true
    AND o.customer_city IS NOT NULL
    AND o.customer_city != ''
    AND EXTRACT(MONTH FROM o.created_at) = current_month
    AND EXTRACT(YEAR FROM o.created_at) = current_year
    GROUP BY o.customer_city
    HAVING COUNT(o.id) > 0
    ORDER BY COUNT(o.id) DESC, SUM(COALESCE(o.final_amount, o.total_amount)) DESC;
END;
$$;