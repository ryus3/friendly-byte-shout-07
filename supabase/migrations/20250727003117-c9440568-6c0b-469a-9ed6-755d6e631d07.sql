-- تنظيف وإعادة حساب إحصائيات المدن بناءً على الطلبات المكتملة فقط
DO $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM now());
    current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
    -- حذف جميع الإحصائيات الحالية لهذا الشهر
    DELETE FROM public.city_order_stats 
    WHERE month = current_month AND year = current_year;
    
    -- إعادة حساب الإحصائيات بناءً على الطلبات المكتملة والمُسلّمة فقط
    INSERT INTO public.city_order_stats (city_name, month, year, total_orders, total_amount)
    SELECT 
        customer_city,
        current_month,
        current_year,
        COUNT(*) as total_orders,
        COALESCE(SUM(final_amount), 0) as total_amount
    FROM public.orders 
    WHERE customer_city IS NOT NULL 
    AND customer_city != '' 
    AND status IN ('completed', 'delivered')
    AND EXTRACT(MONTH FROM created_at) = current_month
    AND EXTRACT(YEAR FROM created_at) = current_year
    GROUP BY customer_city;
    
    RAISE NOTICE 'تم تنظيف وإعادة حساب إحصائيات المدن بناءً على الطلبات المكتملة فقط';
END $$;