-- إصلاح مشاكل البيانات وإنشاء البيانات المطلوبة

-- تحديث البيانات من الطلبات الموجودة
DO $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM now());
    current_year INTEGER := EXTRACT(YEAR FROM now());
    prev_month INTEGER := CASE WHEN current_month = 1 THEN 12 ELSE current_month - 1 END;
    prev_year INTEGER := CASE WHEN current_month = 1 THEN current_year - 1 ELSE current_year END;
BEGIN
    -- إدراج إحصائيات المدن للشهر الحالي بناءً على الطلبات الموجودة
    INSERT INTO public.city_order_stats (city_name, month, year, total_orders, total_amount)
    SELECT 
        COALESCE(customer_city, 'غير محدد') as city_name,
        current_month as month,
        current_year as year,
        COUNT(*) as total_orders,
        COALESCE(SUM(final_amount), 0) as total_amount
    FROM public.orders 
    WHERE customer_city IS NOT NULL
    AND EXTRACT(MONTH FROM created_at) = current_month
    AND EXTRACT(YEAR FROM created_at) = current_year
    GROUP BY customer_city
    ON CONFLICT (city_name, month, year) 
    DO UPDATE SET 
        total_orders = EXCLUDED.total_orders,
        total_amount = EXCLUDED.total_amount,
        updated_at = now();

    -- إحصائيات للشهر السابق للاختبار
    INSERT INTO public.city_order_stats (city_name, month, year, total_orders, total_amount)
    SELECT 
        customer_city as city_name,
        prev_month as month,
        prev_year as year,
        COUNT(*) as total_orders,
        COALESCE(SUM(final_amount), 0) as total_amount
    FROM public.orders 
    WHERE customer_city IS NOT NULL
    AND customer_city IN ('بغداد', 'البصرة')
    GROUP BY customer_city
    ON CONFLICT (city_name, month, year) 
    DO UPDATE SET 
        total_orders = EXCLUDED.total_orders,
        total_amount = EXCLUDED.total_amount,
        updated_at = now();

    -- تفعيل نظام المزايا إذا لم يكن موجود
    IF NOT EXISTS (
        SELECT 1 FROM public.city_monthly_benefits 
        WHERE month = current_month AND year = current_year
    ) THEN
        -- إضافة مزايا لبغداد كمثال
        INSERT INTO public.city_monthly_benefits (
            city_name, month, year, benefit_type, benefit_value, max_usage
        ) VALUES 
        ('بغداد', current_month, current_year, 'discount', 10, 1),
        ('بغداد', current_month, current_year, 'free_delivery', 100, 1);
        
        -- إضافة إشعار
        INSERT INTO public.notifications (
            title, message, type, priority, data
        ) VALUES (
            'مزايا المدينة الشهرية',
            'تم اختيار مدينة بغداد للحصول على مزايا خاصة: خصم 10% + توصيل مجاني',
            'city_benefits_selected',
            'high',
            jsonb_build_object(
                'city_name', 'بغداد',
                'benefits', jsonb_build_array(
                    jsonb_build_object('type', 'discount', 'value', '10%'),
                    jsonb_build_object('type', 'free_delivery', 'value', 'مجاني')
                )
            )
        );
    END IF;
    
    RAISE NOTICE 'تم تحديث البيانات بنجاح';
END $$;