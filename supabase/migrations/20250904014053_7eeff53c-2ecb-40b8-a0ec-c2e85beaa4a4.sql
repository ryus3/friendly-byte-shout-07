-- حذف جميع الفواتير إلا الأحدث (واحدة فقط) - تصحيح المشكلة
DO $$
DECLARE
    latest_invoice_id uuid;
BEGIN
    -- الحصول على معرف الفاتورة الأحدث
    SELECT id INTO latest_invoice_id
    FROM public.delivery_invoices 
    WHERE partner = 'alwaseet'
    ORDER BY 
        COALESCE(issued_at, last_api_updated_at, created_at) DESC NULLS LAST
    LIMIT 1;
    
    -- حذف طلبات الفواتير الأخرى
    IF latest_invoice_id IS NOT NULL THEN
        DELETE FROM public.delivery_invoice_orders 
        WHERE invoice_id != latest_invoice_id;
        
        -- حذف الفواتير الأخرى
        DELETE FROM public.delivery_invoices 
        WHERE partner = 'alwaseet' 
        AND id != latest_invoice_id;
        
        -- تحديث الفاتورة المتبقية لتكون ضمن النطاق الزمني الحالي للاختبار
        UPDATE public.delivery_invoices 
        SET issued_at = '2025-09-01 12:00:00+00'::timestamptz,
            created_at = '2025-09-01 12:00:00+00'::timestamptz
        WHERE id = latest_invoice_id;
        
        RAISE NOTICE 'تم الاحتفاظ بالفاتورة % فقط وحذف الباقي', latest_invoice_id;
    ELSE
        RAISE NOTICE 'لا توجد فواتير للوسيط';
    END IF;
END $$;