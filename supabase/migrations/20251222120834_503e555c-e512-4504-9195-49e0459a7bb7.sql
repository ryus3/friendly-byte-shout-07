-- تحديث الفواتير الموجودة بالقيم الصحيحة من raw JSON
UPDATE delivery_invoices
SET 
  amount = COALESCE(
    NULLIF((raw->>'merchant_price')::numeric, 0),
    NULLIF(amount, 0),
    0
  ),
  orders_count = COALESCE(
    NULLIF((raw->>'delivered_orders_count')::integer, 0),
    NULLIF(orders_count, 0),
    0
  )
WHERE raw IS NOT NULL
  AND (amount = 0 OR amount IS NULL OR orders_count = 0 OR orders_count IS NULL);