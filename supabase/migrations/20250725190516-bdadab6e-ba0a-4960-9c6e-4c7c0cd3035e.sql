-- إنشاء العملاء من بيانات الطلبات الموجودة
INSERT INTO public.customers (
  name, 
  phone, 
  city, 
  province, 
  address, 
  created_by,
  created_at
)
SELECT DISTINCT 
  customer_name,
  customer_phone,
  customer_city,
  customer_province,
  customer_address,
  created_by,
  created_at
FROM public.orders 
WHERE customer_name IS NOT NULL 
AND customer_name != ''
AND NOT EXISTS (
  SELECT 1 FROM public.customers 
  WHERE customers.name = orders.customer_name 
  AND customers.phone = orders.customer_phone
);

-- ربط الطلبات بالعملاء المُنشأين
UPDATE public.orders 
SET customer_id = customers.id
FROM public.customers
WHERE orders.customer_name = customers.name 
AND orders.customer_phone = customers.phone
AND orders.customer_id IS NULL;