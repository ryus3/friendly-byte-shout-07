-- Harden function: set search_path for security
CREATE OR REPLACE FUNCTION public.standardize_delivery_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.delivery_partner IN ('Al-Waseet', 'ALWASEET', 'al-waseet', 'Al-waseet') THEN
    NEW.delivery_partner := 'alwaseet';
  END IF;
  RETURN NEW;
END;
$$;