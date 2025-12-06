-- تصحيح بيانات المنتج المتضرر (ترانشكوت بيجي)
UPDATE inventory
SET 
  quantity = 5,
  reserved_quantity = 0,
  sold_quantity = 0,
  updated_at = now()
WHERE variant_id = '51420d7e-b71f-4c29-8b6e-86ef65e33f32';