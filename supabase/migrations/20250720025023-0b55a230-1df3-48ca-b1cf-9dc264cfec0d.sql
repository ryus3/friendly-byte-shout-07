-- إنشاء دالة generate_product_qrcode المفقودة
CREATE OR REPLACE FUNCTION public.generate_product_qrcode(
    p_product_name text, 
    p_color_name text DEFAULT 'افتراضي'::text, 
    p_size_name text DEFAULT 'افتراضي'::text, 
    p_product_id uuid DEFAULT NULL::uuid,
    p_variant_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
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

-- تحديث دالة تحديث مخزون المتغيرات من المشتريات لتعمل بشكل مثالي
CREATE OR REPLACE FUNCTION public.update_variant_stock_from_purchase(
    p_sku text, 
    p_quantity_change integer, 
    p_cost_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  variant_record RECORD;
  product_record RECORD;
  inventory_record RECORD;
  color_id uuid;
  size_id uuid;
  existing_product_id uuid;
  base_product_name text;
BEGIN
  -- البحث عن المتغير بالباركود/SKU
  SELECT pv.*, p.id as product_id, p.name as product_name
  INTO variant_record
  FROM public.product_variants pv
  JOIN public.products p ON pv.product_id = p.id
  WHERE pv.barcode = p_sku OR pv.sku = p_sku
  LIMIT 1;
  
  -- إذا لم يوجد المتغير، إنشاء منتج ومتغير جديد
  IF variant_record IS NULL THEN
    -- استخراج اسم المنتج الأساسي من SKU
    base_product_name := COALESCE(NULLIF(TRIM(SPLIT_PART(p_sku, '-', 1)), ''), 'منتج جديد');
    
    -- البحث عن منتج موجود بنفس الاسم الأساسي
    SELECT id INTO existing_product_id 
    FROM public.products 
    WHERE LOWER(name) LIKE LOWER('%' || base_product_name || '%')
    AND is_active = true
    LIMIT 1;
    
    -- البحث عن اللون الافتراضي أو إنشاؤه
    SELECT id INTO color_id FROM public.colors WHERE name = 'افتراضي' LIMIT 1;
    IF color_id IS NULL THEN
      INSERT INTO public.colors (name, hex_code) VALUES ('افتراضي', '#808080') RETURNING id INTO color_id;
    END IF;
    
    -- البحث عن الحجم الافتراضي أو إنشاؤه
    SELECT id INTO size_id FROM public.sizes WHERE name = 'افتراضي' LIMIT 1;
    IF size_id IS NULL THEN
      INSERT INTO public.sizes (name, type) VALUES ('افتراضي', 'letter') RETURNING id INTO size_id;
    END IF;
    
    -- إنشاء أو استخدام منتج موجود
    IF existing_product_id IS NOT NULL THEN
      SELECT * INTO product_record FROM public.products WHERE id = existing_product_id;
    ELSE
      INSERT INTO public.products (
        name,
        cost_price,
        base_price,
        is_active,
        created_by
      ) VALUES (
        base_product_name,
        p_cost_price,
        p_cost_price * 1.3,
        true,
        auth.uid()
      ) RETURNING * INTO product_record;
    END IF;
    
    -- إنشاء متغير جديد
    INSERT INTO public.product_variants (
      product_id,
      color_id,
      size_id,
      barcode,
      sku,
      price,
      cost_price,
      is_active
    ) VALUES (
      product_record.id,
      color_id,
      size_id,
      p_sku,
      p_sku,
      p_cost_price * 1.3,
      p_cost_price,
      true
    ) RETURNING *, product_record.id as product_id INTO variant_record;
    
  ELSE
    -- تحديث سعر التكلفة للمتغير الموجود
    UPDATE public.product_variants 
    SET cost_price = p_cost_price,
        updated_at = now()
    WHERE id = variant_record.id;
    
    -- تحديث سعر التكلفة في المنتج أيضاً
    UPDATE public.products 
    SET cost_price = p_cost_price,
        updated_at = now()
    WHERE id = variant_record.product_id;
  END IF;
  
  -- التحقق من وجود سجل في المخزون
  SELECT * INTO inventory_record
  FROM public.inventory
  WHERE product_id = variant_record.product_id 
  AND variant_id = variant_record.id;
  
  IF inventory_record IS NULL THEN
    -- إنشاء سجل مخزون جديد
    INSERT INTO public.inventory (
      product_id,
      variant_id,
      quantity,
      min_stock,
      reserved_quantity,
      last_updated_by
    ) VALUES (
      variant_record.product_id,
      variant_record.id,
      p_quantity_change,
      0,
      0,
      auth.uid()
    );
  ELSE
    -- تحديث الكمية الموجودة
    UPDATE public.inventory 
    SET quantity = quantity + p_quantity_change,
        updated_at = now(),
        last_updated_by = auth.uid()
    WHERE product_id = variant_record.product_id 
    AND variant_id = variant_record.id;
  END IF;
  
END;
$$;