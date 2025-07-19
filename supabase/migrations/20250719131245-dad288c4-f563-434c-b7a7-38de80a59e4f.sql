-- توليد QR codes للمنتجات الموجودة التي لا تحتوي على QR codes
DO $$
DECLARE
    product_record RECORD;
    variant_record RECORD;
    qr_data JSONB;
BEGIN
    -- تحديث المنتجات الموجودة لتوليد QR codes
    FOR product_record IN 
        SELECT * FROM public.products WHERE is_active = true
    LOOP
        -- توليد QR code للمنتج الأساسي
        qr_data := generate_product_qrcode(
            product_record.name, 
            'افتراضي', 
            'افتراضي', 
            product_record.id
        );
        
        -- تحديث المنتج بـ QR code الجديد
        UPDATE public.products 
        SET barcode = qr_data->>'id',
            updated_at = now()
        WHERE id = product_record.id;
        
        -- حفظ بيانات QR في الجدول المخصص
        INSERT INTO public.qr_codes (qr_id, product_id, qr_data)
        VALUES (qr_data->>'id', product_record.id, qr_data)
        ON CONFLICT (qr_id) DO UPDATE SET
            qr_data = EXCLUDED.qr_data,
            updated_at = now();
    END LOOP;
    
    -- توليد QR codes للمتغيرات الموجودة
    FOR variant_record IN 
        SELECT 
            pv.*,
            p.name as product_name,
            c.name as color_name,
            s.name as size_name
        FROM public.product_variants pv
        LEFT JOIN public.products p ON pv.product_id = p.id
        LEFT JOIN public.colors c ON pv.color_id = c.id
        LEFT JOIN public.sizes s ON pv.size_id = s.id
        WHERE pv.is_active = true
    LOOP
        -- توليد QR code للمتغير
        qr_data := generate_product_qrcode(
            COALESCE(variant_record.product_name, 'منتج'),
            COALESCE(variant_record.color_name, 'افتراضي'),
            COALESCE(variant_record.size_name, 'افتراضي'),
            variant_record.product_id,
            variant_record.id
        );
        
        -- تحديث المتغير بـ QR code الجديد
        UPDATE public.product_variants 
        SET barcode = qr_data->>'id',
            updated_at = now()
        WHERE id = variant_record.id;
        
        -- حفظ بيانات QR في الجدول المخصص
        INSERT INTO public.qr_codes (qr_id, product_id, variant_id, qr_data)
        VALUES (qr_data->>'id', variant_record.product_id, variant_record.id, qr_data)
        ON CONFLICT (qr_id) DO UPDATE SET
            qr_data = EXCLUDED.qr_data,
            updated_at = now();
    END LOOP;
    
    RAISE NOTICE 'تم توليد QR codes لجميع المنتجات والمتغيرات الموجودة';
END $$;