-- إضافة CASCADE لحذف QR codes تلقائياً عند حذف المنتج
ALTER TABLE qr_codes 
DROP CONSTRAINT qr_codes_product_id_fkey;

-- إعادة إضافة المفتاح الخارجي مع CASCADE
ALTER TABLE qr_codes 
ADD CONSTRAINT qr_codes_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;