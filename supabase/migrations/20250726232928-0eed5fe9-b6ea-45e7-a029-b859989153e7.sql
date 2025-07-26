-- تشغيل تحليل الجنس للعملاء الحاليين لتحسين الأداء
DO $$
DECLARE
    customer_record RECORD;
BEGIN
    -- تحديث تحليل جنس جميع العملاء الذين لديهم طلبات
    FOR customer_record IN 
        SELECT DISTINCT c.id 
        FROM customers c 
        INNER JOIN orders o ON c.id = o.customer_id 
        WHERE o.status IN ('completed', 'delivered')
    LOOP
        PERFORM public.analyze_customer_gender(customer_record.id);
    END LOOP;
    
    RAISE NOTICE 'تم تحديث تحليل جنس العملاء بنجاح';
END $$;