-- تحديث دالة تحديث المخزون من فواتير الشراء
CREATE OR REPLACE FUNCTION public.update_variant_stock_from_purchase(
  p_sku text, 
  p_quantity_change integer, 
  p_cost_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  variant_record RECORD;
  product_record RECORD;
  inventory_record RECORD;
  color_id uuid;
  size_id uuid;
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
    
    -- إنشاء منتج جديد
    INSERT INTO public.products (
      name,
      cost_price,
      base_price,
      is_active,
      created_by
    ) VALUES (
      'منتج جديد - ' || p_sku,
      p_cost_price,
      p_cost_price * 1.3, -- هامش ربح افتراضي 30%
      true,
      auth.uid()
    ) RETURNING * INTO product_record;
    
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
    
    RAISE NOTICE 'تم إنشاء منتج جديد: % مع المتغير: %', product_record.name, p_sku;
  ELSE
    -- تحديث سعر التكلفة إذا تغير
    UPDATE public.product_variants 
    SET cost_price = p_cost_price,
        updated_at = now()
    WHERE id = variant_record.id;
    
    -- تحديث سعر التكلفة في جدول المنتجات أيضاً
    UPDATE public.products 
    SET cost_price = p_cost_price,
        updated_at = now()
    WHERE id = variant_record.product_id;
    
    RAISE NOTICE 'تم تحديث سعر تكلفة المنتج الموجود: %', variant_record.product_name;
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
    
    RAISE NOTICE 'تم إنشاء سجل مخزون جديد للمنتج % بكمية %', p_sku, p_quantity_change;
  ELSE
    -- تحديث الكمية الموجودة
    UPDATE public.inventory 
    SET quantity = quantity + p_quantity_change,
        updated_at = now(),
        last_updated_by = auth.uid()
    WHERE product_id = variant_record.product_id 
    AND variant_id = variant_record.id;
    
    RAISE NOTICE 'تم تحديث مخزون المنتج % من % إلى %', p_sku, inventory_record.quantity, inventory_record.quantity + p_quantity_change;
  END IF;
  
  -- إشعار النجاح
  RAISE NOTICE 'تم تحديث مخزون % بكمية % بنجاح', p_sku, p_quantity_change;
END;
$function$;