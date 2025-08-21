-- Standardize delivery partner names
UPDATE orders 
SET delivery_partner = 'alwaseet' 
WHERE delivery_partner IN ('Al-Waseet', 'ALWASEET', 'al-waseet', 'Al-waseet');

-- Create function to ensure all new orders use standardized name
CREATE OR REPLACE FUNCTION standardize_delivery_partner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_partner IN ('Al-Waseet', 'ALWASEET', 'al-waseet', 'Al-waseet') THEN
    NEW.delivery_partner := 'alwaseet';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically standardize delivery partner names
DROP TRIGGER IF EXISTS trigger_standardize_delivery_partner ON orders;
CREATE TRIGGER trigger_standardize_delivery_partner
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION standardize_delivery_partner();