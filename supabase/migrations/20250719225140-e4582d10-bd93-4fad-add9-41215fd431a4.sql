-- إضافة المنتج المفقود من فاتورة الشراء إلى المخزون
DO $$
DECLARE
  product_id UUID := '116ed0b0-72b1-4186-a5ba-09e319a9aee0';
  color_id UUID := 'cf5c1574-71a0-43b7-8f6e-36bd884347eb';
  size_id UUID := 'b67118c4-c0fc-4d31-b0a8-c2559ac5308d';
  new_variant_id UUID;
BEGIN
  -- إنشاء المتغير المفقود
  INSERT INTO product_variants (
    product_id,
    color_id,
    size_id,
    barcode,
    sku,
    price,
    cost_price,
    is_active
  ) VALUES (
    product_id,
    color_id,
    size_id,
    'RYUS-1752964267498-LPAJ',
    'RYUS-1752964267498-LPAJ',
    50000,
    29000,
    true
  ) RETURNING id INTO new_variant_id;
  
  -- إضافته للمخزون
  INSERT INTO inventory (
    product_id,
    variant_id,
    quantity,
    min_stock,
    reserved_quantity,
    last_updated_by
  ) VALUES (
    product_id,
    new_variant_id,
    1, -- الكمية من فاتورة الشراء
    0,
    0,
    '91484496-b887-44f7-9e5d-be9db5567604'::uuid
  );
  
  RAISE NOTICE 'تم إضافة المنتج المفقود للمخزون بنجاح';
END $$;