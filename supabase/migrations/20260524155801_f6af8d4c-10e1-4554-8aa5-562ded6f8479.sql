
-- 1) calculate_order_amounts: تخطّي طلبات التسليم الجزئي
CREATE OR REPLACE FUNCTION public.calculate_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ✅ احترام final_amount المؤكَّد لطلبات التسليم الجزئي (يشمل أي زيادة/خصم من شركة التوصيل)
  IF COALESCE(NEW.order_type,'') = 'partial_delivery' THEN
    RETURN NEW;
  END IF;

  NEW.final_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0));
  NEW.sales_amount := GREATEST(0, COALESCE(NEW.total_amount, 0));
  RETURN NEW;
END;
$$;

-- 2) normalize_order_amounts: تخطّي طلبات التسليم الجزئي
CREATE OR REPLACE FUNCTION public.normalize_order_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.order_type,'') = 'partial_delivery' THEN
    RETURN NEW;
  END IF;

  NEW.sales_amount := COALESCE(NEW.total_amount, 0);
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  RETURN NEW;
END;
$$;

-- 3) validate_order_calculations: تخطّي طلبات التسليم الجزئي
CREATE OR REPLACE FUNCTION public.validate_order_calculations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.order_type,'') = 'partial_delivery' THEN
    RETURN NEW;
  END IF;

  NEW.sales_amount := COALESCE(NEW.total_amount, 0);
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  NEW.sales_amount := GREATEST(0, NEW.sales_amount);
  NEW.final_amount := GREATEST(0, NEW.final_amount);
  RETURN NEW;
END;
$$;

-- 4) إعادة تطبيق التصحيح للطلب
UPDATE public.orders
SET 
  final_amount      = 25000,
  price_increase    = 1000,
  discount          = 0,
  price_change_type = 'increase',
  updated_at        = now()
WHERE id = 'dab3eeba-5b93-4e8d-a8d4-316808e2193f';
