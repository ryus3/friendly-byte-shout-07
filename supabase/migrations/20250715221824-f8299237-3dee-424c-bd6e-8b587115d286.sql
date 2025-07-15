-- إنشاء دالة للتحقق من المخزون المتاح للبيع
CREATE OR REPLACE FUNCTION public.get_available_stock(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  available_stock INTEGER;
BEGIN
  SELECT GREATEST(0, quantity - reserved_quantity) INTO available_stock
  FROM public.inventory
  WHERE product_id = p_product_id AND 
        (p_variant_id IS NULL OR variant_id = p_variant_id);
  
  RETURN COALESCE(available_stock, 0);
END;
$$;