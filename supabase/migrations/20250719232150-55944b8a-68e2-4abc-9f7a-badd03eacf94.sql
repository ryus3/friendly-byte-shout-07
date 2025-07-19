-- إضافة دالة generate_product_qrcode المفقودة
CREATE OR REPLACE FUNCTION generate_product_qrcode(
    p_product_name text,
    p_color_name text DEFAULT 'افتراضي',
    p_size_name text DEFAULT 'افتراضي',
    p_product_id uuid DEFAULT NULL,
    p_variant_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    qr_id text;
    qr_data jsonb;
BEGIN
    -- توليد ID فريد للـ QR code
    qr_id := 'QR_' || EXTRACT(EPOCH FROM now())::bigint || '_' || floor(random() * 1000)::text;
    
    -- بناء بيانات QR code
    qr_data := jsonb_build_object(
        'id', qr_id,
        'product_name', p_product_name,
        'color', p_color_name,
        'size', p_size_name,
        'product_id', p_product_id,
        'variant_id', p_variant_id,
        'created_at', now(),
        'type', CASE 
            WHEN p_variant_id IS NOT NULL THEN 'variant'
            ELSE 'product'
        END
    );
    
    RETURN qr_data;
END;
$$;