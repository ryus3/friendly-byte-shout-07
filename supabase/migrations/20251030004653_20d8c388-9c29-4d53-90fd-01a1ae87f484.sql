-- توحيد تسمية الرقم الثاني في ai_orders ليطابق orders
ALTER TABLE ai_orders RENAME COLUMN secondary_phone TO customer_phone2;