-- إصلاح مشكلة purchase_number ambiguous في جدول purchases
-- إضافة مفتاح فريد لـ purchase_number إذا لم يكن موجود
DO $$
BEGIN
    -- التأكد من وجود عمود purchase_number
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchases' 
        AND column_name = 'purchase_number'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_number TEXT;
    END IF;
    
    -- إنشاء function لتوليد رقم الفاتورة التلقائي
    CREATE OR REPLACE FUNCTION generate_purchase_number()
    RETURNS TEXT AS $function$
    DECLARE
        new_number TEXT;
        max_num INTEGER;
    BEGIN
        -- الحصول على أعلى رقم فاتورة
        SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM '[0-9]+') AS INTEGER)), 0)
        INTO max_num
        FROM public.purchases
        WHERE purchase_number ~ '^PUR-[0-9]+$';
        
        -- توليد الرقم الجديد
        new_number := 'PUR-' || LPAD((max_num + 1)::TEXT, 6, '0');
        
        RETURN new_number;
    END;
    $function$ LANGUAGE plpgsql;
    
    -- إنشاء trigger لتوليد رقم الفاتورة تلقائياً
    CREATE OR REPLACE FUNCTION set_purchase_number()
    RETURNS TRIGGER AS $trigger$
    BEGIN
        IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
            NEW.purchase_number := generate_purchase_number();
        END IF;
        RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    -- حذف الـ trigger إذا كان موجود وإنشاؤه من جديد
    DROP TRIGGER IF EXISTS purchase_number_trigger ON public.purchases;
    CREATE TRIGGER purchase_number_trigger
        BEFORE INSERT ON public.purchases
        FOR EACH ROW
        EXECUTE FUNCTION set_purchase_number();
        
    -- تحديث الفواتير الموجودة التي لا تحتوي على رقم فاتورة
    UPDATE public.purchases 
    SET purchase_number = generate_purchase_number()
    WHERE purchase_number IS NULL OR purchase_number = '';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في إعداد أرقام الفواتير: %', SQLERRM;
END $$;