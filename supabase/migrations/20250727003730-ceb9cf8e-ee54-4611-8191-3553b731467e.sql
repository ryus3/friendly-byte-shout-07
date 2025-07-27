-- حذف جميع إحصائيات المدن وإعادة إنشائها من الصفر
DO $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM now());
    current_year INTEGER := EXTRACT(YEAR FROM now());
    order_record RECORD;
    city_totals RECORD;
BEGIN
    -- حذف جميع إحصائيات المدن
    DELETE FROM public.city_order_stats;
    
    -- إعادة إنشاء الإحصائيات من الطلبات المكتملة والمُسلّمة فقط
    FOR city_totals IN 
        SELECT 
            customer_city,
            COUNT(*) as total_orders,
            COALESCE(SUM(final_amount), 0) as total_amount,
            EXTRACT(MONTH FROM created_at) as month,
            EXTRACT(YEAR FROM created_at) as year
        FROM public.orders 
        WHERE customer_city IS NOT NULL 
        AND customer_city != '' 
        AND status IN ('completed', 'delivered')
        GROUP BY customer_city, EXTRACT(MONTH FROM created_at), EXTRACT(YEAR FROM created_at)
    LOOP
        INSERT INTO public.city_order_stats (city_name, month, year, total_orders, total_amount)
        VALUES (city_totals.customer_city, city_totals.month, city_totals.year, city_totals.total_orders, city_totals.total_amount);
    END LOOP;
    
    RAISE NOTICE 'تم إعادة إنشاء إحصائيات المدن من الطلبات المكتملة فقط';
END $$;