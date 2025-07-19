-- إضافة عمود sku إلى product_variants إذا لم يكن موجود
DO $$
BEGIN
    -- التحقق من وجود عمود sku في product_variants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'sku'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.product_variants ADD COLUMN sku TEXT;
        
        -- تحديث SKU للمتغيرات الموجودة باستخدام barcode إذا كان متاح
        UPDATE public.product_variants 
        SET sku = barcode 
        WHERE sku IS NULL AND barcode IS NOT NULL;
        
        -- إنشاء SKUs للمتغيرات التي لا تحتوي على barcode
        UPDATE public.product_variants 
        SET sku = 'VAR-' || substr(id::text, 1, 8)
        WHERE sku IS NULL;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في إضافة عمود SKU: %', SQLERRM;
END $$;