-- إصلاح دالة generate_telegram_code لاستخدام telegram_code بدلاً من employee_code
CREATE OR REPLACE FUNCTION generate_telegram_code(user_id_input uuid, username_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  short_username TEXT;
  short_id TEXT;
  telegram_code_result TEXT;
BEGIN
  -- أخذ أول 3 أحرف من اسم المستخدم وتحويلها للأحرف الكبيرة
  short_username := UPPER(LEFT(username_input, 3));
  
  -- أخذ آخر 3 أرقام من user_id
  short_id := RIGHT(REPLACE(user_id_input::TEXT, '-', ''), 3);
  
  -- دمج الكود
  telegram_code_result := short_username || short_id;
  
  -- إدخال الكود في الجدول (استخدام الاسم الصحيح للعمود)
  INSERT INTO employee_telegram_codes (user_id, telegram_code)
  VALUES (user_id_input, telegram_code_result)
  ON CONFLICT (user_id) DO UPDATE SET 
    telegram_code = EXCLUDED.telegram_code,
    telegram_chat_id = NULL,
    linked_at = NULL,
    updated_at = now();
  
  RETURN telegram_code_result;
END;
$$;

-- المرحلة 2: Triggers للخصم والإرجاع التلقائي
CREATE OR REPLACE FUNCTION process_delivered_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_item RECORD;
  variant_record RECORD;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
    FOR order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      SELECT * INTO variant_record 
      FROM product_variants 
      WHERE id = order_item.variant_id;
      
      IF variant_record.id IS NOT NULL THEN
        UPDATE product_variants
        SET 
          quantity = GREATEST(0, quantity - order_item.quantity),
          updated_at = now()
        WHERE id = order_item.variant_id;
        
        INSERT INTO sold_products_log (
          variant_id,
          product_id,
          order_id,
          quantity_sold,
          sale_price,
          cost_price,
          sold_at,
          created_by
        ) VALUES (
          order_item.variant_id,
          variant_record.product_id,
          NEW.id,
          order_item.quantity,
          order_item.price,
          variant_record.cost_price,
          now(),
          NEW.created_by
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_process_delivered_inventory ON orders;
CREATE TRIGGER trigger_process_delivered_inventory
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION process_delivered_order_inventory();

-- دالة الإرجاع التلقائي
CREATE OR REPLACE FUNCTION process_returned_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_item RECORD;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock') THEN
    FOR order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      UPDATE product_variants
      SET 
        quantity = quantity + order_item.quantity,
        updated_at = now()
      WHERE id = order_item.variant_id;
      
      DELETE FROM sold_products_log
      WHERE order_id = NEW.id AND variant_id = order_item.variant_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;
CREATE TRIGGER trigger_process_returned_inventory
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'returned_in_stock' AND OLD.status IS DISTINCT FROM 'returned_in_stock')
  EXECUTE FUNCTION process_returned_order_inventory();

-- المرحلة 4: تحديث trigger التوليد التلقائي
CREATE OR REPLACE FUNCTION auto_generate_telegram_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
BEGIN
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active')) 
     AND NEW.is_active = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM employee_telegram_codes 
      WHERE user_id = NEW.user_id
    ) THEN
      SELECT generate_telegram_code(
        NEW.user_id,
        COALESCE(NEW.username, 'USER')
      ) INTO new_code;
      
      RAISE NOTICE 'تم توليد رمز تليغرام تلقائياً: %', new_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_generate_telegram_code_trigger ON profiles;
CREATE TRIGGER auto_generate_telegram_code_trigger
  AFTER INSERT OR UPDATE OF status, is_active ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_telegram_code();