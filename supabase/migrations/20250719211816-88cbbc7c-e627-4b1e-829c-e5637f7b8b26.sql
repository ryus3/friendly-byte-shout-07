-- إنشاء دالة لتحديث المخزون من المشتريات
CREATE OR REPLACE FUNCTION public.update_variant_stock_from_purchase(
  p_sku text,
  p_quantity_change integer,
  p_cost_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  variant_record RECORD;
  product_record RECORD;
  inventory_record RECORD;
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
      barcode,
      sku,
      price,
      cost_price,
      is_active
    ) VALUES (
      product_record.id,
      p_sku,
      p_sku,
      p_cost_price * 1.3,
      p_cost_price,
      true
    ) RETURNING *, product_record.id as product_id INTO variant_record;
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
  
  -- إشعار النجاح
  RAISE NOTICE 'تم تحديث مخزون % بكمية % بنجاح', p_sku, p_quantity_change;
END;
$function$;

-- إضافة عمود للمعلومات الإضافية في جدول المشتريات إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchases' 
                 AND column_name = 'items'::name) THEN
    ALTER TABLE public.purchases ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- إضافة عمود معرف رقم الفاتورة إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchases' 
                 AND column_name = 'purchase_number'::name) THEN
    ALTER TABLE public.purchases ADD COLUMN purchase_number text;
  END IF;
END $$;

-- إضافة حقل اسم المورد إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchases' 
                 AND column_name = 'supplier'::name) THEN
    ALTER TABLE public.purchases ADD COLUMN supplier text;
  END IF;
END $$;

-- إضافة trigger لتوليد رقم الفاتورة تلقائياً
CREATE OR REPLACE FUNCTION public.auto_generate_purchase_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    NEW.purchase_number := generate_purchase_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- إضافة trigger إذا لم يكن موجوداً
DROP TRIGGER IF EXISTS trigger_auto_generate_purchase_number ON public.purchases;
CREATE TRIGGER trigger_auto_generate_purchase_number
  BEFORE INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_purchase_number();