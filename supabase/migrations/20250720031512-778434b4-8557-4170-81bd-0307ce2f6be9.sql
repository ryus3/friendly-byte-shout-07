-- حذف حركة النقد للفاتورة المحذوفة رقم 1
DELETE FROM public.cash_movements 
WHERE reference_id = '17c19691-18e9-4eb4-9b38-26fe7b1e240a'::uuid
AND reference_type = 'purchase';

-- تحديث رصيد القاصة الرئيسية ليكون حقيقي بناءً على الحركات
UPDATE public.cash_sources 
SET current_balance = (
  SELECT 
    initial_balance + 
    COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0)
  FROM public.cash_movements cm
  WHERE cm.cash_source_id = cash_sources.id
)
WHERE name = 'القاصة الرئيسية';

-- إضافة منتج "سوت شبك سمائي" من فاتورة 2
DO $$
DECLARE
  new_product_id uuid;
  new_variant_id uuid;
  color_id uuid;
  size_id uuid;
  current_user_id uuid;
BEGIN
  -- الحصول على معرف المستخدم الحالي
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- الحصول على اللون والحجم الافتراضي
  SELECT id INTO color_id FROM public.colors WHERE name = 'افتراضي' LIMIT 1;
  SELECT id INTO size_id FROM public.sizes WHERE name = 'افتراضي' LIMIT 1;
  
  -- إنشاء منتج جديد "سوت شبك سمائي"
  INSERT INTO public.products (
    name,
    cost_price,
    base_price,
    is_active,
    created_by
  ) VALUES (
    'سوت شبك سمائي',
    29000,
    37700,
    true,
    current_user_id
  ) RETURNING id INTO new_product_id;
  
  -- إنشاء متغير للمنتج
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
    new_product_id,
    color_id,
    size_id,
    'RYUS-SKY-BLUE-001',
    'RYUS-SKY-BLUE-001',
    37700,
    29000,
    true
  ) RETURNING id INTO new_variant_id;
  
  -- إضافة المنتج للمخزون
  INSERT INTO public.inventory (
    product_id,
    variant_id,
    quantity,
    min_stock,
    reserved_quantity,
    last_updated_by
  ) VALUES (
    new_product_id,
    new_variant_id,
    1,
    0,
    0,
    current_user_id
  );
  
  RAISE NOTICE 'تم إنشاء منتج سوت شبك سمائي بنجاح';
END $$;